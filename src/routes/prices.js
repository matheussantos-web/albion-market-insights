const express = require('express');
const { getDb } = require('../db/init');
const cache = require('../services/priceCache');

const router = express.Router();

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
        ORDER BY mp2.observed_at DESC
        LIMIT 1
      )
    GROUP BY l.name
    ORDER BY mp.sell_price_min ASC
  `;
  res.json(db.prepare(query).all(item));
});

router.get('/:uniqueName', (req, res) => {
  const db = getDb();
  const { city, limit = 50, source } = req.query;

  let query = `
    SELECT
      mp.id, i.name_ptbr, mp.item_unique_name, l.name AS city,
      mp.quality, mp.sell_price_min, mp.sell_price_max,
      mp.buy_price_min, mp.buy_price_max, mp.observed_at, mp.source
    FROM market_prices mp
    JOIN locations l ON l.id = mp.location_id
    LEFT JOIN items i ON i.unique_name = mp.item_unique_name
    WHERE mp.item_unique_name = ?
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

  res.json(db.prepare(query).all(...params));
});

router.get('/:uniqueName/latest', (req, res) => {
  const cacheKey = `${req.params.uniqueName}:latest`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

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
        ORDER BY mp2.observed_at DESC
        LIMIT 1
      )
    GROUP BY l.name
    ORDER BY mp.sell_price_min ASC
  `;
  const rows = db.prepare(query).all(req.params.uniqueName);
  cache.set(cacheKey, rows);
  res.json(rows);
});

module.exports = router;
