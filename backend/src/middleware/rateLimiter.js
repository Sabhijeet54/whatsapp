const NodeCache = require("node-cache");

const cache = new NodeCache({ stdTTL: 60, checkperiod: 10 });

function apiRateLimiter(limit = 80) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const key = `rate:${ip}`;
    const current = cache.get(key) || 0;

    if (current >= limit) {
      return res.status(429).json({ message: "Too many requests. Please try again shortly." });
    }

    cache.set(key, current + 1);
    next();
  };
}

module.exports = apiRateLimiter;
