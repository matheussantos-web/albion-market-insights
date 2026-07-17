const express = require('express');
const { getDb } = require('../db/init');
const { requireContributorKey } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/ingest
 * Body: array de observações de preço, no formato que o albiondata-client
 * (ou seu Express ingest server local) já produz. Exemplo de item:
 * {
 *   "itemId": "T4_BAG",
 *   "city": "Caerleon",
 *   "quality": 1,
 *   "sellPriceMin": 1200,
 *   "sellPriceMax": 1500,
 *   "buyPriceMin": 900,
 *   "buyPriceMax": 1100,
 *   "timestamp": "2026-07-17T12:00:00Z"
 * }
 */
router.post('/', requireContributorKey, (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [req.body];
  const db = getDb();

  const getLocationId = db.prepare('SELECT id FROM locations WHERE name = ?');
  const insertPrice = db.prepare(`
    INSERT INTO market_prices
      (item_unique_name, location_id, quality, sell_price_min, sell_price_max,
       buy_price_min, buy_price_max, observed_at, contributor_id, source)
    VALUES (@item_unique_name, @location_id, @quality, @sell_price_min, @sell_price_max,
            @buy_price_min, @buy_price_max, @observed_at, @contributor_id, 'private')
  `);

  const insertMany = db.transaction((rows) => {
    let inserted = 0;
    for (const row of rows) {
      const location = getLocationId.get(row.city);
      if (!location) continue; // cidade desconhecida, ignora silenciosamente

      insertPrice.run({
        item_unique_name: row.itemId,
        location_id: location.id,
        quality: row.quality ?? 1,
        sell_price_min: row.sellPriceMin ?? null,
        sell_price_max: row.sellPriceMax ?? null,
        buy_price_min: row.buyPriceMin ?? null,
        buy_price_max: row.buyPriceMax ?? null,
        observed_at: row.timestamp,
        contributor_id: req.contributor.id,
      });
      inserted += 1;
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
