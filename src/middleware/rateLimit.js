const config = require('../config');

const hits = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, timestamps] of hits) {
    const fresh = timestamps.filter((t) => now - t < 60_000);
    if (fresh.length === 0) hits.delete(key);
    else hits.set(key, fresh);
  }
}

setInterval(cleanup, 60_000);

function rateLimit(maxPerMinute) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const timestamps = hits.get(ip) || [];
    const fresh = timestamps.filter((t) => now - t < 60_000);

    if (fresh.length >= maxPerMinute) {
      return res.status(429).json({ error: 'rate limit excedido, tente novamente em 1 minuto' });
    }

    fresh.push(now);
    hits.set(ip, fresh);
    next();
  };
}

module.exports = { rateLimit, fetchRateLimit: rateLimit(config.rateLimit.fetchPerMinute) };
