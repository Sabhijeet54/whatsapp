const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode");
const qrcodeTerminal = require("qrcode-terminal");
const pino = require("pino");

const AUTH_DIR = path.join(process.cwd(), "data", "baileys_auth");

class WhatsappService {
  constructor(io) {
    this.io = io;
    this.sock = null;
    this.status = "disconnected";
    this.lastQr = null;
    this.initialized = false;
    this.reconnectAttempts = 0;
  }

  emitStatus(extra = {}) {
    this.io.emit("whatsapp:status", {
      status: this.status,
      hasQr: Boolean(this.lastQr),
      ...extra,
    });
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      fs.mkdirSync(AUTH_DIR, { recursive: true });

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion();

      const logger = pino({ level: "silent" });

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        printQRInTerminal: false,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
      });

      this.sock.ev.on("creds.update", saveCreds);
    } catch (err) {
      console.error("WhatsApp init error:", err.message);
      this.initialized = false;
      this.sock = null;
      this.status = "disconnected";
      this.emitStatus({ reason: "Initialization failed: " + err.message });
      throw err;
    }

    this.sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.status = "qr_required";
        try {
          this.lastQr = await qrcode.toDataURL(qr);
          qrcodeTerminal.generate(qr, { small: true });
        } catch (e) {
          console.error("QR generation error:", e.message);
        }
        this.emitStatus({ qrCode: this.lastQr });
      }

      if (connection === "connecting") {
        this.status = "loading";
        this.emitStatus({ percent: 0, message: "Connecting..." });
      }

      if (connection === "open") {
        this.status = "connected";
        this.lastQr = null;
        this.reconnectAttempts = 0;
        this.emitStatus();
      }

      if (connection === "close") {
        this.initialized = false;
        this.sock = null;

        const statusCode =
          lastDisconnect?.error instanceof Boom
            ? lastDisconnect.error.output?.statusCode
            : lastDisconnect?.error?.output?.statusCode;

        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          this.status = "disconnected";
          this.lastQr = null;
          this.reconnectAttempts = 0;
          this.emitStatus({ reason: "Logged out" });
          return;
        }

        if (this.reconnectAttempts >= 5) {
          this.status = "reconnect_failed";
          this.reconnectAttempts = 0;
          this.emitStatus();
          return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(5000 * this.reconnectAttempts, 30000);
        this.status = "disconnected";
        this.emitStatus({ reason: `Connection closed, reconnecting in ${delay / 1000}s...` });

        setTimeout(() => {
          this.initialize().catch((err) => {
            console.error("Reconnect failed:", err.message);
            this.status = "reconnect_failed";
            this.initialized = false;
            this.emitStatus();
          });
        }, delay);
      }
    });
  }

  getStatus() {
    return {
      status: this.status,
      qrCode: this.lastQr,
    };
  }

  async sendMessage({ number, message, mediaPath, caption }) {
    if (this.status !== "connected" || !this.sock) {
      throw new Error("WhatsApp is not connected");
    }

    const jid = `${number}@s.whatsapp.net`;
    const SEND_TIMEOUT = 30000; // 30s max per message

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Send timeout after 30s")), SEND_TIMEOUT)
    );

    try {
      const sendPromise = (async () => {
        if (mediaPath) {
          const ext = path.extname(mediaPath).toLowerCase();
          const mime = this._getMimeType(ext);
          const buffer = fs.readFileSync(mediaPath);
          const fileName = path.basename(mediaPath);
          const text = caption || message || "";

          if (mime.startsWith("image/")) {
            await this.sock.sendMessage(jid, { image: buffer, caption: text, mimetype: mime });
          } else if (mime.startsWith("video/")) {
            await this.sock.sendMessage(jid, { video: buffer, caption: text, mimetype: mime });
          } else {
            await this.sock.sendMessage(jid, {
              document: buffer,
              mimetype: mime,
              fileName,
              caption: text,
            });
          }
          return;
        }

        await this.sock.sendMessage(jid, { text: message });
      })();

      await Promise.race([sendPromise, timeoutPromise]);
    } catch (err) {
      // If socket is dead, mark disconnected
      if (!this.sock?.user) {
        this.status = "disconnected";
        this.emitStatus();
      }
      throw err;
    }
  }

  _getMimeType(ext) {
    const map = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    return map[ext] || "application/octet-stream";
  }

  async logout() {
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (err) {
        console.error("Logout error:", err.message);
      }
    }
    // Clean up auth data
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    this._reset();
  }

  // Force reset everything - use when service is stuck
  forceReset() {
    if (this.sock) {
      try { this.sock.end(undefined); } catch {}
    }
    this._reset();
    console.log("WhatsApp service force reset");
  }

  _reset() {
    this.sock = null;
    this.status = "disconnected";
    this.lastQr = null;
    this.initialized = false;
    this.reconnectAttempts = 0;
    this.emitStatus();
  }
}

module.exports = WhatsappService;
