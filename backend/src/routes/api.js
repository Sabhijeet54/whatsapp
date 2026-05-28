const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { randomUUID } = require("crypto");
const config = require("../config");
const { asyncHandler } = require("../middleware/errorHandlers");
const { parseNumbersFromText } = require("../utils/numberParser");
const { parseUploadedFile } = require("../utils/fileParser");
const historyService = require("../services/historyService");
const dataService = require("../services/dataService");
const queueService = require("../services/queueService");

const storage = multer.diskStorage({
  destination(req, file, cb) {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
    cb(null, config.uploadsDir);
  },
  filename(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = /\.(txt|csv|xlsx|xls|jpg|jpeg|png|gif|webp|pdf|doc|docx)$/i;
    if (!allowed.test(path.extname(file.originalname))) {
      return cb(new Error("File type not allowed"));
    }
    cb(null, true);
  },
});

function createApiRouter({ whatsappService }) {
  const router = express.Router();

  router.post("/login", asyncHandler(async (req, res) => {
    try {
      await whatsappService.initialize();
    } catch (err) {
      // initialize() already resets its own state on failure
      console.error("Login init error:", err.message);
    }
    res.json({ message: "Login initialization started", ...whatsappService.getStatus() });
  }));

  router.get("/status", (req, res) => {
    res.json({
      whatsapp: whatsappService.getStatus(),
      queue: queueService.getStats(),
    });
  });

  router.post("/logout", asyncHandler(async (req, res) => {
    await whatsappService.logout();
    res.json({ message: "Logged out successfully" });
  }));

  router.post("/reset", (req, res) => {
    whatsappService.forceReset();
    res.json({ message: "WhatsApp service reset. You can login again." });
  });

  router.post("/parse-text", (req, res) => {
    const { text = "" } = req.body;
    const parsed = parseNumbersFromText(text, config.defaultCountryCode);
    dataService.saveContacts(parsed.validNumbers.map((number) => ({ number })));
    res.json(parsed);
  });

  router.post("/upload", upload.single("file"), asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    const parsed = parseUploadedFile(req.file.path, req.file.originalname, config.defaultCountryCode);
    dataService.saveContacts(parsed.mappedContacts);
    res.json(parsed);
  }));

  router.post("/send", upload.single("media"), asyncHandler(async (req, res) => {
    if (whatsappService.getStatus().status !== "connected") {
      return res.status(400).json({ message: "WhatsApp is not connected. Please login first." });
    }
    if (queueService.getStats().running) {
      return res.status(409).json({ message: "A sending job is already running. Stop it first." });
    }

    const { numbers = "[]", message = "", caption = "", scheduleAt } = req.body;
    const minDelayMs = Math.max(Number(req.body.minDelayMs) || 3000, 2000);
    const maxDelayMs = Math.max(Number(req.body.maxDelayMs) || 7000, minDelayMs + 1000);

    let contacts;
    try { contacts = JSON.parse(numbers); } catch { contacts = []; }
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ message: "At least one valid contact is required" });
    }
    if (!message && !req.file) {
      return res.status(400).json({ message: "Message or media is required" });
    }

    // Deduplicate contacts by number
    const seen = new Set();
    contacts = contacts.filter((c) => {
      if (!c?.number || seen.has(c.number)) return false;
      seen.add(c.number);
      return true;
    });

    const runId = randomUUID();
    const history = historyService.addHistory({
      runId,
      message,
      caption,
      total: contacts.length,
      sent: 0,
      failed: 0,
      pending: contacts.length,
      failedNumbers: [],
      sentNumbers: [],
      status: "queued",
    });

    const mediaPath = req.file?.path;
    const startSend = () => {
      queueService.enqueueBulk({
        runId,
        contacts,
        message,
        mediaPath,
        caption,
        minDelayMs,
        maxDelayMs,
      });

      queueService.processQueue({
        whatsappService,
        onProgress: ({ status, number }) => {
          const current = historyService.getHistoryById(history.id);
          if (!current) return;

          const patch = {};
          if (status === "sent") {
            patch.sent = (current.sent || 0) + 1;
            patch.pending = Math.max((current.pending || 0) - 1, 0);
            if (!current.sentNumbers) current.sentNumbers = [];
            current.sentNumbers.push(number);
            patch.sentNumbers = current.sentNumbers;
          } else {
            patch.failed = (current.failed || 0) + 1;
            patch.pending = Math.max((current.pending || 0) - 1, 0);
            if (!current.failedNumbers) current.failedNumbers = [];
            current.failedNumbers.push(number);
            patch.failedNumbers = current.failedNumbers;
          }

          historyService.updateHistory(history.id, patch);
        },
        onCompleted: ({ interrupted, sent, failed, pending }) => {
          historyService.updateHistory(history.id, {
            status: interrupted ? "stopped" : "completed",
            sent,
            failed,
            pending,
            completedAt: new Date().toISOString(),
          });
          if (mediaPath) fs.unlink(mediaPath, () => {});
        },
      }).catch((err) => {
        console.error("Queue error:", err.message);
        historyService.updateHistory(history.id, { status: "error" });
        if (mediaPath) fs.unlink(mediaPath, () => {});
      });
    };

    if (scheduleAt && new Date(scheduleAt).getTime() > Date.now()) {
      const scheduleDelay = new Date(scheduleAt).getTime() - Date.now();
      setTimeout(startSend, scheduleDelay);
      historyService.updateHistory(history.id, {
        status: "scheduled",
        scheduleAt,
      });
      return res.json({ message: "Message batch scheduled", runId, scheduleAt });
    }

    startSend();
    return res.json({ message: "Bulk sending started", runId });
  }));

  router.post("/queue/pause", (req, res) => {
    queueService.pauseQueue();
    res.json({ message: "Queue paused" });
  });

  router.post("/queue/resume", (req, res) => {
    queueService.resumeQueue();
    res.json({ message: "Queue resumed" });
  });

  router.post("/queue/stop", (req, res) => {
    queueService.stopQueue();
    res.json({ message: "Queue stopped" });
  });

  router.get("/history", (req, res) => {
    res.json(historyService.getHistory());
  });

  router.delete("/history", (req, res) => {
    historyService.clearHistory();
    res.json({ message: "History cleared" });
  });

  router.get("/history/export", (req, res) => {
    const history = historyService.getHistory();
    const header = "id,createdAt,total,sent,failed,pending,status";
    const lines = history.map(
      (item) =>
        `${item.id},${item.createdAt},${item.total || 0},${item.sent || 0},${item.failed || 0},${item.pending || 0},${item.status || ""}`
    );
    const csv = [header, ...lines].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=history.csv");
    res.send(csv);
  });

  router.get("/contacts", (req, res) => {
    const q = String(req.query.q || "").toLowerCase();
    const contacts = dataService.listContacts().filter((item) => {
      if (!q) return true;
      return item.number.includes(q) || (item.name || "").toLowerCase().includes(q);
    });
    res.json(contacts);
  });

  router.post("/contacts/import", (req, res) => {
    const contacts = Array.isArray(req.body.contacts) ? req.body.contacts : [];
    const saved = dataService.saveContacts(contacts);
    res.json(saved);
  });

  router.get("/contacts/export", (req, res) => {
    const csv = dataService.exportContactsCsv();
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=contacts.csv");
    res.send(csv);
  });

  router.get("/templates", (req, res) => {
    res.json(dataService.listTemplates());
  });

  router.post("/templates", (req, res) => {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ message: "title and message are required" });
    }
    const item = dataService.addTemplate({ title, message });
    res.json(item);
  });

  router.delete("/templates/:id", (req, res) => {
    dataService.deleteTemplate(req.params.id);
    res.json({ message: "Template deleted" });
  });

  router.get("/health", (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  return router;
}

module.exports = createApiRouter;
