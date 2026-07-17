const express = require('express');
const { getDb } = require('../db/init');
const router = express.Router();

const SENTINELS = new Set([999999, 1000000, 9999999, 99999999, 2147483647]);
const MAX_PRICE = 50000000;

function isSentinel(v) {
  if (!v || v <= 0) return true;
  if (SENTINELS.has(v)) return true;
  if (v > MAX_PRICE) return true;
  return false;
}

router.get('/', (req, res) => {
  const {
    originCity = 'Caerleon',
    minProfit = 0,
    category = '',
    maxAgeCity = 60,
    maxAgeBM = 180,
    premium = 'false',
    sort = 'profit',
    limit = 50
  } = req.query;

  const db = getDb();
  const taxRate = premium === 'true' ? 0.025 : 0.04;
  const now = Date.now();

  const cityMaxAge = Number(maxAgeCity) * 60 * 1000;
  const bmMaxAge = Number(maxAgeBM) * 60 * 1000;

  const cityCutoff = new Date(now - cityMaxAge).toISOString();
  const bmCutoff = new Date(now - bmMaxAge).toISOString();

  const cityRows = db.prepare(`
    SELECT mp.item_unique_name, i.name_ptbr, i.name_en, i.tier, i.category,
           mp.sell_price_min, mp.observed_at
    FROM market_prices mp
    LEFT JOIN items i ON i.unique_name = mp.item_unique_name
    JOIN locations l ON l.id = mp.location_id
    WHERE l.name = ?
      AND mp.sell_price_min > 0
      AND mp.sell_price_min < ${MAX_PRICE}
      AND mp.observed_at >= ?
    ORDER BY mp.observed_at DESC
  `).all(originCity, cityCutoff);

  const cityLatest = {};
  for (const row of cityRows) {
    if (!cityLatest[row.item_unique_name]) {
      cityLatest[row.item_unique_name] = row;
    }
  }

  const bmRows = db.prepare(`
    SELECT mp.item_unique_name, mp.buy_price_max, mp.observed_at
    FROM market_prices mp
    JOIN locations l ON l.id = mp.location_id
    WHERE l.name = 'Black Market'
      AND mp.buy_price_max > 0
      AND mp.buy_price_max < ${MAX_PRICE}
      AND mp.observed_at >= ?
    ORDER BY mp.observed_at DESC
  `).all(bmCutoff);

  const bmLatest = {};
  for (const row of bmRows) {
    if (!bmLatest[row.item_unique_name]) {
      bmLatest[row.item_unique_name] = row;
    }
  }

  const opportunities = [];

  for (const itemId in cityLatest) {
    const city = cityLatest[itemId];
    const bm = bmLatest[itemId];
    if (!bm) continue;

    if (isSentinel(city.sell_price_min) || isSentinel(bm.buy_price_max)) continue;

    if (category && city.category !== category) continue;

    const sellPrice = city.sell_price_min;
    const bmPrice = bm.buy_price_max;
    const taxValue = Math.round(bmPrice * taxRate);
    const netProfit = bmPrice - sellPrice - taxValue;
    const roi = sellPrice > 0 ? (netProfit / sellPrice * 100) : 0;

    if (netProfit <= 0) continue;
    if (netProfit < Number(minProfit)) continue;

    opportunities.push({
      item_id: itemId,
      item_name: city.name_ptbr || city.name_en || itemId,
      tier: city.tier,
      category: city.category,
      origin_city: originCity,
      sell_price: sellPrice,
      bm_buy_price: bmPrice,
      tax_rate: taxRate,
      tax_value: taxValue,
      net_profit: netProfit,
      roi_percent: Math.round(roi * 10) / 10,
      updated_origin: city.observed_at,
      updated_bm: bm.observed_at,
    });
  }

  if (sort === 'roi') {
    opportunities.sort((a, b) => b.roi_percent - a.roi_percent);
  } else {
    opportunities.sort((a, b) => b.net_profit - a.net_profit);
  }

  const limited = opportunities.slice(0, Number(limit));

  res.json({
    opportunities: limited,
    total_found: opportunities.length,
    generated_at: new Date().toISOString(),
    tax_rate: taxRate,
    origin_city: originCity,
  });
});

module.exports = router;
