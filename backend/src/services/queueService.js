const EventEmitter = require("events");
const config = require("../config");
const { applyNameVariable } = require("../utils/numberParser");

const queueEvents = new EventEmitter();

const state = {
  running: false,
  paused: false,
  stopRequested: false,
  activeRunId: null,
  queue: [],
  sent: 0,
  failed: 0,
  pending: 0,
  logs: [],
  minDelayMs: 3000,
  maxDelayMs: 7000,
  sentTimestamps: [],
};

function getStats() {
  return {
    running: state.running,
    paused: state.paused,
    sent: state.sent,
    failed: state.failed,
    pending: state.pending,
    total: state.sent + state.failed + state.pending,
    logs: state.logs.slice(-200),
    runId: state.activeRunId,
  };
}

function pushLog(message, level = "info") {
  const log = { time: new Date().toISOString(), level, message };
  state.logs.push(log);
  if (state.logs.length > 1000) state.logs.shift();
  queueEvents.emit("log", log);
  queueEvents.emit("stats", getStats());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function checkRateLimit() {
  // Sliding-window safety throttle helps reduce account risk when sending in bulk.
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;
  state.sentTimestamps = state.sentTimestamps.filter((t) => t > oneMinuteAgo);
  if (state.sentTimestamps.length >= config.maxSendPerMinute) {
    return false;
  }
  state.sentTimestamps.push(now);
  return true;
}

async function processQueue({ whatsappService, onProgress, onCompleted }) {
  state.running = true;
  state.stopRequested = false;
  queueEvents.emit("stats", getStats());

  while (state.queue.length > 0 && !state.stopRequested) {
    if (state.paused) {
      await sleep(500);
      continue;
    }

    const job = state.queue.shift();
    state.pending = state.queue.length;

    try {
      while (!checkRateLimit()) {
        pushLog("Rate safety pause for 60s", "warn");
        await sleep(60_000);
      }

      const finalMessage = applyNameVariable(job.message, job.contact);
      await whatsappService.sendMessage({
        number: job.contact.number,
        message: finalMessage,
        mediaPath: job.mediaPath,
        caption: job.caption,
      });

      state.sent += 1;
      pushLog(`Sent to ${job.contact.number}`);
      onProgress?.({ status: "sent", number: job.contact.number });
    } catch (error) {
      state.failed += 1;
      pushLog(`Failed for ${job.contact.number}: ${error.message}`, "error");
      onProgress?.({ status: "failed", number: job.contact.number, reason: error.message });
    }

    const delay = randomDelay(state.minDelayMs, state.maxDelayMs);
    await sleep(delay);
  }

  const interrupted = state.stopRequested;
  state.running = false;
  state.paused = false;
  state.stopRequested = false;
  state.pending = state.queue.length;
  queueEvents.emit("stats", getStats());
  onCompleted?.({ interrupted, ...getStats() });
}

function enqueueBulk({ runId, contacts, message, mediaPath, caption, minDelayMs, maxDelayMs }) {
  if (state.running) {
    throw new Error("A sending job is already running");
  }

  state.activeRunId = runId;
  state.queue = contacts.map((contact) => ({ contact, message, mediaPath, caption }));
  state.sent = 0;
  state.failed = 0;
  state.pending = state.queue.length;
  state.logs = [];
  state.minDelayMs = Number(minDelayMs) || 3000;
  state.maxDelayMs = Number(maxDelayMs) || 7000;
  state.sentTimestamps = [];
  queueEvents.emit("stats", getStats());
}

function stopQueue() {
  state.stopRequested = true;
  state.queue = [];
  state.pending = 0;
  pushLog("Stop requested by user", "warn");
}

function pauseQueue() {
  if (state.running) {
    state.paused = true;
    pushLog("Queue paused", "warn");
  }
}

function resumeQueue() {
  if (state.running) {
    state.paused = false;
    pushLog("Queue resumed");
  }
}

module.exports = {
  queueEvents,
  getStats,
  enqueueBulk,
  processQueue,
  stopQueue,
  pauseQueue,
  resumeQueue,
  pushLog,
};
