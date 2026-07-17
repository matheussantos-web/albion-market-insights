const config = require('../config');

const cache = new Map();

function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > config.cache.latestTtlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function set(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

function invalidate(itemUniqueName) {
  for (const key of cache.keys()) {
    if (key.startsWith(itemUniqueName + ':')) cache.delete(key);
  }
}

function clear() {
  cache.clear();
}

module.exports = { get, set, invalidate, clear };
