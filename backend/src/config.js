const path = require("path");

const config = {
  port: Number(process.env.PORT || 5000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  uploadsDir: path.join(process.cwd(), "uploads"),
  dataDir: path.join(process.cwd(), "data"),
  historyFile: path.join(process.cwd(), "data", "history.json"),
  contactsFile: path.join(process.cwd(), "data", "contacts.json"),
  templatesFile: path.join(process.cwd(), "data", "templates.json"),
  chromiumPath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  headless: (process.env.WHATSAPP_HEADLESS || "true") === "true",
  maxSendPerMinute: Number(process.env.MAX_SEND_PER_MINUTE || 18),
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || "91",
};

module.exports = config;