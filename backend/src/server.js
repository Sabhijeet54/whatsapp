require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const config = require("./config");
const createApiRouter = require("./routes/api");
const apiRateLimiter = require("./middleware/rateLimiter");
const { errorHandler } = require("./middleware/errorHandlers");
const WhatsappService = require("./services/whatsappService");
const queueService = require("./services/queueService");
const { ensureFile } = require("./utils/jsonStore");

fs.mkdirSync(config.uploadsDir, { recursive: true });
fs.mkdirSync(config.dataDir, { recursive: true });
ensureFile(config.historyFile, []);
ensureFile(config.contactsFile, []);
ensureFile(config.templatesFile, []);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.frontendUrl,
    methods: ["GET", "POST"],
  },
});

const whatsappService = new WhatsappService(io);

app.use(cors({ origin: config.frontendUrl }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(apiRateLimiter(150));

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api", createApiRouter({ whatsappService }));

queueService.queueEvents.on("log", (log) => io.emit("queue:log", log));
queueService.queueEvents.on("stats", (stats) => io.emit("queue:stats", stats));

io.on("connection", (socket) => {
  socket.emit("whatsapp:status", whatsappService.getStatus());
  socket.emit("queue:stats", queueService.getStats());
});

app.use(errorHandler);

server.listen(config.port, () => {
  console.log(`Backend running on http://localhost:${config.port}`);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
