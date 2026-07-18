const express = require('express');
const { getDb } = require('../db/init');

const router = express.Router();

const SENTINELS = new Set([999999, 1000000, 9999999, 99999999, 2147483647, 0]);
const MAX_PRICE = 50000000;

function isSentinel(v) {
  if (!v || v <= 0) return true;
  if (SENTINELS.has(v)) return true;
  if (v > MAX_PRICE) return true;
  return false;
}

/**
 * POST /api/ingest
 * Accepts anonymous market data from any client.
 * No item validation — game server is the authority (AODP approach).
 * Auto-creates unknown locations.
 */
router.post('/', (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [req.body];
  const db = getDb();

  const getLocationId = db.prepare('SELECT id FROM locations WHERE name = ?');
  const insertLocation = db.prepare('INSERT OR IGNORE INTO locations (name) VALUES (?)');
  const getInsertedLocation = db.prepare('SELECT id FROM locations WHERE name = ?');

  const insertPrice = db.prepare(`
    INSERT INTO market_prices
      (item_unique_name, location_id, quality, sell_price_min, sell_price_max,
       buy_price_min, buy_price_max, observed_at, contributor_id, source)
    VALUES (@item_unique_name, @location_id, @quality, @sell_price_min, @sell_price_max,
            @buy_price_min, @buy_price_max, @observed_at, @contributor_id, 'private')
  `);

  const insertMany = db.transaction((rows) => {
    let inserted = 0;
    let rejected = 0;
    let skippedLocation = 0;
    let skippedSentinel = 0;

    for (const row of rows) {
      let location = getLocationId.get(row.city);

      if (!location) {
        insertLocation.run(row.city);
        location = getInsertedLocation.get(row.city);
        if (!location) { skippedLocation++; continue; }
      }

      if (isSentinel(row.sellPriceMin)) { skippedSentinel++; continue; }

      insertPrice.run({
        item_unique_name: row.itemId,
        location_id: location.id,
        quality: row.quality ?? 1,
        sell_price_min: row.sellPriceMin ?? null,
        sell_price_max: isSentinel(row.sellPriceMax) ? null : row.sellPriceMax ?? null,
        buy_price_min: isSentinel(row.buyPriceMin) ? null : row.buyPriceMin ?? null,
        buy_price_max: isSentinel(row.buyPriceMax) ? null : row.buyPriceMax ?? null,
        observed_at: row.timestamp,
        contributor_id: null,
      });
      inserted += 1;
    }

    if (skippedLocation > 0 || skippedSentinel > 0) {
      console.log(`[ingest] inseridos: ${inserted}, loc_skip: ${skippedLocation}, sentinel_skip: ${skippedSentinel}`);
    }
    return inserted;
  });

  try {
    const inserted = insertMany(payload);
    res.status(201).json({ inserted });
  } catch (err) {
    console.error('[ingest] erro:', err.message);
    res.status(400).json({ error: 'payload inválido', detail: err.message });
  }
});

module.exports = router;
