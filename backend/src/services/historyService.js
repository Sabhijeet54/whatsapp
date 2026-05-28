const { randomUUID } = require("crypto");
const config = require("../config");
const { readJson, writeJson } = require("../utils/jsonStore");

// In-memory cache to avoid race conditions from concurrent file reads/writes
let cache = null;
let flushTimer = null;

function loadCache() {
  if (!cache) cache = readJson(config.historyFile, []);
  return cache;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try { if (cache) writeJson(config.historyFile, cache); }
    catch (err) { console.error("History flush error:", err.message); }
  }, 2000);
}

function flushNow() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  try { if (cache) writeJson(config.historyFile, cache); }
  catch (err) { console.error("History flush error:", err.message); }
}

function getHistory() {
  return [...loadCache()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function getHistoryById(id) {
  return loadCache().find((item) => item.id === id) || null;
}

function addHistory(payload) {
  const history = loadCache();
  const item = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...payload,
  };
  history.push(item);
  flushNow();
  return item;
}

function updateHistory(id, patch) {
  const history = loadCache();
  const index = history.findIndex((item) => item.id === id);
  if (index === -1) return null;
  history[index] = { ...history[index], ...patch };
  scheduleFlush();
  return history[index];
}

function clearHistory() {
  cache = [];
  flushNow();
}

module.exports = {
  getHistory,
  getHistoryById,
  addHistory,
  updateHistory,
  clearHistory,
  flushNow,
};
