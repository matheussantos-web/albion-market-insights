require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || './data/albion.db',
  adminSecret: process.env.ADMIN_SECRET || 'troque-isso-aqui',
  itemsJsonUrl: process.env.ITEMS_JSON_URL || 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json',
  publicSyncRegion: process.env.PUBLIC_SYNC_REGION || 'europe',
  rateLimit: {
    fetchPerMinute: Number(process.env.RATE_LIMIT_FETCH_PER_MINUTE) || 10,
  },
  cache: {
    latestTtlMs: Number(process.env.CACHE_LATEST_TTL_MS) || 60_000,
  },
};

module.exports = config;
