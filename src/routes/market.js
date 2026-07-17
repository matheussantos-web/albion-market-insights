const express = require('express');
const { getDb } = require('../db/init');
const router = express.Router();

router.get('/summary', (req, res) => {
  const { city } = req.query;
  const db = getDb();

  const cityFilter = city ? 'AND l.name = ?' : '';
  const cityParams = city ? [city] : [];

  const rows = db.prepare(`
    SELECT
      mp.item_unique_name,
      i.name_ptbr,
      i.name_en,
      i.tier,
      i.category,
      l.name AS city,
      mp.sell_price_min,
      mp.observed_at,
      mp.id
    FROM market_prices mp
    JOIN locations l ON l.id = mp.location_id
    LEFT JOIN items i ON i.unique_name = mp.item_unique_name
    WHERE mp.sell_price_min > 0
      ${cityFilter}
  `).all(...cityParams);

  const grouped = {};
  for (const r of rows) {
    const key = `${r.item_unique_name}|${r.city}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  const analysis = [];
  for (const key in grouped) {
    const entries = grouped[key].sort((a, b) => new Date(a.observed_at) - new Date(b.observed_at));
    if (entries.length < 2) continue;

    const latest = entries[entries.length - 1];
    const earliest = entries[0];
    const pricePrev = earliest.sell_price_min;
    const priceNow = latest.sell_price_min;
    const delta = pricePrev > 0 ? ((priceNow - pricePrev) / pricePrev * 100) : 0;

    analysis.push({
      item: latest.item_unique_name,
      name: latest.name_ptbr || latest.name_en || latest.item_unique_name,
      tier: latest.tier,
      category: latest.category,
      city: latest.city,
      price: priceNow,
      pricePrev,
      delta: Math.round(delta * 100) / 100,
      volume: entries.length,
      observedAt: latest.observed_at
    });
  }

  const gainers = analysis
    .filter(a => a.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);

  const losers = analysis
    .filter(a => a.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5);

  const mostTraded = [...analysis]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5);

  res.json({ gainers, losers, mostTraded });
});

router.get('/trend', (req, res) => {
  const { city } = req.query;
  const db = getDb();

  const cityFilter = city ? 'AND l.name = ?' : '';
  const cityParams = city ? [city] : [];

  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m-%d %H:00:00', mp.observed_at) AS hour,
      AVG(mp.sell_price_min) AS avg_price,
      COUNT(DISTINCT mp.item_unique_name) AS item_count
    FROM market_prices mp
    JOIN locations l ON l.id = mp.location_id
    WHERE mp.sell_price_min > 0
      ${cityFilter}
    GROUP BY hour
    ORDER BY hour ASC
  `).all(...cityParams);

  res.json(rows);
});

module.exports = router;
