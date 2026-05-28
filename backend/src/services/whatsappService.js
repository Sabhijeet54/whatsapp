const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const qrcodeTerminal = require("qrcode-terminal");
const config = require("../config");

class WhatsappService {
  constructor(io) {
    this.io = io;
    this.client = null;
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

  initialize() {
    if (this.initialized) return;

    // LocalAuth persists session on disk, so users typically don't rescan QR after first login.
    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: "bulk-sender" }),
      puppeteer: {
        headless: config.headless,
        executablePath: config.chromiumPath,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
      },
    });

    this.client.on("qr", async (qr) => {
      this.status = "qr_required";
      this.lastQr = await qrcode.toDataURL(qr);
      qrcodeTerminal.generate(qr, { small: true });
      this.emitStatus({ qrCode: this.lastQr });
    });

    this.client.on("loading_screen", (percent, message) => {
      this.status = "loading";
      this.emitStatus({ percent, message });
    });

    this.client.on("authenticated", () => {
      this.status = "authenticated";
      this.emitStatus();
    });

    this.client.on("ready", () => {
      this.status = "connected";
      this.lastQr = null;
      this.reconnectAttempts = 0;
      this.emitStatus();
    });

    this.client.on("disconnected", (reason) => {
      this.status = "disconnected";
      this.emitStatus({ reason });
      if (this.reconnectAttempts >= 3) {
        this.status = "reconnect_failed";
        this.initialized = false;
        this.emitStatus();
        return;
      }
      this.reconnectAttempts++;
      const delay = 5000 * this.reconnectAttempts;
      setTimeout(() => {
        this.client.initialize().catch(() => {
          this.status = "reconnect_failed";
          this.initialized = false;
          this.emitStatus();
        });
      }, delay);
    });

    this.client.initialize().catch((err) => {
      console.error("WhatsApp init failed:", err.message);
      this.status = "disconnected";
      this.initialized = false;
      this.emitStatus();
    });
    this.initialized = true;
  }

  getStatus() {
    return {
      status: this.status,
      qrCode: this.lastQr,
    };
  }

  async sendMessage({ number, message, mediaPath, caption }) {
    if (this.status !== "connected") {
      throw new Error("WhatsApp is not connected");
    }

    const chatId = `${number}@c.us`;
    try {
      if (mediaPath) {
        const media = MessageMedia.fromFilePath(mediaPath);
        await this.client.sendMessage(chatId, media, { caption: caption || message });
        return;
      }
      await this.client.sendMessage(chatId, message);
    } catch (err) {
      if (!this.client?.info) {
        this.status = "disconnected";
        this.emitStatus();
      }
      throw err;
    }
  }

  async logout() {
    if (!this.client) return;
    try {
      await this.client.logout();
    } catch (err) {
      console.error("Logout error:", err.message);
    }
    this.status = "disconnected";
    this.lastQr = null;
    this.initialized = false;
    this.reconnectAttempts = 0;
    this.emitStatus();
  }
}

module.exports = WhatsappService;
