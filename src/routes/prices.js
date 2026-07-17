const express = require('express');
const { getDb } = require('../db/init');
const cache = require('../services/priceCache');

const router = express.Router();

const SENTINEL_FILTER = 'AND mp.sell_price_min > 0 AND mp.sell_price_min < 50000000';

// GET /api/prices/compare?item=T4_BAG — compara preços entre cidades
router.get('/compare', (req, res) => {
  const { item } = req.query;
  if (!item) return res.status(400).json({ error: 'item é obrigatório' });

  const db = getDb();
  const query = `
    SELECT l.name AS city, i.name_ptbr, mp.item_unique_name,
           mp.sell_price_min, mp.sell_price_max,
           mp.buy_price_min, mp.buy_price_max, mp.observed_at, mp.source
    FROM market_prices mp
    JOIN locations l ON l.id = mp.location_id
    LEFT JOIN items i ON i.unique_name = mp.item_unique_name
    WHERE mp.item_unique_name = ?
      AND mp.id = (
        SELECT mp2.id FROM market_prices mp2
        WHERE mp2.item_unique_name = mp.item_unique_name
          AND mp2.location_id = mp.location_id
          ${SENTINEL_FILTER}
        ORDER BY mp2.observed_at DESC
        LIMIT 1
      )
    GROUP BY l.name
    ORDER BY mp.sell_price_min ASC
  `;
  res.json(db.prepare(query).all(item));
});

// GET /api/prices/:uniqueName — histórico com fallback AODP síncrono
router.get('/:uniqueName', async (req, res) => {
  const db = getDb();
  const { city, limit = 50, source } = req.query;

  function runQuery() {
    let query = `
      SELECT
        mp.id, i.name_ptbr, mp.item_unique_name, l.name AS city,
        mp.quality, mp.sell_price_min, mp.sell_price_max,
        mp.buy_price_min, mp.buy_price_max, mp.observed_at, mp.source
      FROM market_prices mp
      JOIN locations l ON l.id = mp.location_id
      LEFT JOIN items i ON i.unique_name = mp.item_unique_name
      WHERE mp.item_unique_name = ?
        ${SENTINEL_FILTER}
    `;
    const params = [req.params.uniqueName];

    if (city) {
      query += ' AND l.name = ?';
      params.push(city);
    }
    if (source) {
      query += ' AND mp.source = ?';
      params.push(source);
    }

    query += ' ORDER BY mp.observed_at DESC LIMIT ?';
    params.push(Number(limit));

    return db.prepare(query).all(...params);
  }

  let rows = runQuery();

  if (rows.length === 0) {
    const { fetchItemFromAodp } = require('../services/publicSync');
    try {
      await fetchItemFromAodp(req.params.uniqueName);
      rows = runQuery();
    } catch (err) {
      console.error(`[prices/history] fallback AODP falhou para ${req.params.uniqueName}: ${err.message}`);
    }
  }

  res.json(rows);
});

// GET /api/prices/:uniqueName/latest — preço atual com fallback AODP síncrono
router.get('/:uniqueName/latest', async (req, res) => {
  const cacheKey = `${req.params.uniqueName}:latest`;
  const cached = cache.get(cacheKey);
  if (cached && cached.length > 0) return res.json(cached);

  const db = getDb();
  const query = `
    SELECT l.name AS city, i.name_ptbr, mp.item_unique_name,
           mp.sell_price_min, mp.sell_price_max,
           mp.buy_price_min, mp.buy_price_max, mp.observed_at, mp.source
    FROM market_prices mp
    JOIN locations l ON l.id = mp.location_id
    LEFT JOIN items i ON i.unique_name = mp.item_unique_name
    WHERE mp.item_unique_name = ?
      ${SENTINEL_FILTER}
      AND mp.id = (
        SELECT mp2.id FROM market_prices mp2
        WHERE mp2.item_unique_name = mp.item_unique_name
          AND mp2.location_id = mp.location_id
          ${SENTINEL_FILTER}
        ORDER BY mp2.observed_at DESC
        LIMIT 1
      )
    GROUP BY l.name
    ORDER BY mp.sell_price_min ASC
  `;
  let rows = db.prepare(query).all(req.params.uniqueName);

  if (rows.length === 0) {
    const { fetchItemFromAodp } = require('../services/publicSync');
    try {
      await fetchItemFromAodp(req.params.uniqueName);
      rows = db.prepare(query).all(req.params.uniqueName);
    } catch (err) {
      console.error(`[prices/latest] fallback AODP falhou para ${req.params.uniqueName}: ${err.message}`);
    }
  }

  cache.set(cacheKey, rows);
  res.json(rows);
});

module.exports = router;
