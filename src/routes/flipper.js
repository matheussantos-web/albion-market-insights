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

function resolveContributorId(db, req) {
  const token = req.header('x-session-token');
  if (!token) return null;
  const sess = db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime(\'now\')').get(token);
  if (!sess) return null;
  const contrib = db.prepare('SELECT id FROM contributors WHERE name = (SELECT username FROM users WHERE id = ?)').get(sess.user_id);
  return contrib ? contrib.id : null;
}

// ─── BLACK MARKET MODE ───
function flipBlackMarket(db, req) {
  const {
    originCity = 'Caerleon',
    minProfit = 0,
    category = '',
    maxAgeCity = 60,
    maxAgeBM = 180,
    premium = 'false',
    sort = 'profit',
    limit = 50,
    scope = 'all',
  } = req.query;

  const taxRate = premium === 'true' ? 0.025 : 0.04;
  const now = Date.now();
  const cityCutoff = new Date(now - Number(maxAgeCity) * 60000).toISOString();
  const bmCutoff = new Date(now - Number(maxAgeBM) * 60000).toISOString();

  const contributorId = scope === 'private' ? resolveContributorId(db, req) : null;

  let cityWhere = `l.name = ? AND mp.sell_price_min > 0 AND mp.sell_price_min < ${MAX_PRICE} AND mp.observed_at >= ?`;
  const cityArgs = [originCity, cityCutoff];

  if (scope === 'private' && contributorId) {
    cityWhere += ' AND mp.contributor_id = ?';
    cityArgs.push(contributorId);
  }

  const cityRows = db.prepare(`
    SELECT mp.item_unique_name, i.name_ptbr, i.name_en, i.tier, i.category,
           mp.sell_price_min, mp.observed_at
    FROM market_prices mp
    LEFT JOIN items i ON i.unique_name = mp.item_unique_name
    JOIN locations l ON l.id = mp.location_id
    WHERE ${cityWhere}
    ORDER BY mp.observed_at DESC
  `).all(...cityArgs);

  const cityLatest = {};
  for (const row of cityRows) {
    if (!cityLatest[row.item_unique_name]) cityLatest[row.item_unique_name] = row;
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
    if (!bmLatest[row.item_unique_name]) bmLatest[row.item_unique_name] = row;
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

  opportunities.sort(sort === 'roi'
    ? (a, b) => b.roi_percent - a.roi_percent
    : (a, b) => b.net_profit - a.net_profit
  );

  return {
    mode: 'blackmarket',
    opportunities: opportunities.slice(0, Number(limit)),
    total_found: opportunities.length,
    generated_at: new Date().toISOString(),
    tax_rate: taxRate,
    origin_city: originCity,
  };
}

// ─── UPGRADE MODE ───
function flipUpgrade(db, req) {
  const {
    city = '',
    tier = 0,
    minProfit = 0,
    sort = 'profit',
    limit = 50,
    scope = 'all',
  } = req.query;

  const taxRate = 0.04;
  const now = Date.now();
  const maxAge = 60;
  const cutoff = new Date(now - maxAge * 60000).toISOString();

  const contributorId = scope === 'private' ? resolveContributorId(db, req) : null;

  const tierFilter = Number(tier) > 0 ? Number(tier) : null;

  // Get latest price per item per city per enchant
  let priceWhere = `mp.sell_price_min > 0 AND mp.sell_price_min < ${MAX_PRICE} AND mp.observed_at >= ?`;
  const priceArgs = [cutoff];

  if (city) {
    priceWhere += ' AND l.name = ?';
    priceArgs.push(city);
  }
  if (tierFilter) {
    priceWhere += ' AND i.tier = ?';
    priceArgs.push(tierFilter);
  }
  if (scope === 'private' && contributorId) {
    priceWhere += ' AND mp.contributor_id = ?';
    priceArgs.push(contributorId);
  }

  const allPrices = db.prepare(`
    SELECT mp.item_unique_name, i.name_ptbr, i.name_en, i.tier, i.category, i.enchantment,
           l.name AS city_name, mp.sell_price_min, mp.observed_at
    FROM market_prices mp
    LEFT JOIN items i ON i.unique_name = mp.item_unique_name
    JOIN locations l ON l.id = mp.location_id
    WHERE ${priceWhere}
    ORDER BY mp.observed_at DESC
  `).all(...priceArgs);

  // Derive base_name (strip @N suffix) and dedup: latest per base+city+enchant
  const latest = {};
  for (const row of allPrices) {
    const baseName = row.item_unique_name.replace(/@\d+$/, '');
    const enchant = row.enchantment;
    const key = `${baseName}|${row.city_name}|${enchant}`;
    if (!latest[key]) {
      latest[key] = { ...row, base_name: baseName };
    }
  }

  // Get upgrade costs
  const costs = db.prepare('SELECT tier, from_enchant, to_enchant, material_name, material_cost FROM upgrade_costs').all();

  // Match enchantment pairs
  const opportunities = [];
  for (const key in latest) {
    const low = latest[key];
    const highKey = `${low.base_name}|${low.city_name}|${low.enchantment + 1}`;
    const high = latest[highKey];
    if (!high) continue;

    if (isSentinel(low.sell_price_min) || isSentinel(high.sell_price_min)) continue;

    const costRow = costs.find(c =>
      c.tier === low.tier &&
      c.from_enchant === low.enchantment &&
      c.to_enchant === high.enchantment
    );
    if (!costRow) continue;

    const buyPrice = low.sell_price_min;
    const sellPrice = high.sell_price_min;
    const upgradeCost = costRow.material_cost;
    const taxValue = Math.round(sellPrice * taxRate);
    const netProfit = sellPrice - buyPrice - upgradeCost - taxValue;
    const roi = (buyPrice + upgradeCost) > 0
      ? (netProfit / (buyPrice + upgradeCost) * 100)
      : 0;

    if (netProfit <= 0) continue;
    if (netProfit < Number(minProfit)) continue;

    opportunities.push({
      item_id: low.base_name,
      item_name: low.name_ptbr || low.name_en || low.base_name,
      tier: low.tier,
      category: low.category,
      city: low.city_name,
      buy_enchant: low.enchantment,
      sell_enchant: high.enchantment,
      buy_price: buyPrice,
      sell_price: sellPrice,
      material_name: costRow.material_name,
      upgrade_cost: upgradeCost,
      tax_rate: taxRate,
      tax_value: taxValue,
      net_profit: netProfit,
      roi_percent: Math.round(roi * 10) / 10,
      updated_buy: low.observed_at,
      updated_sell: high.observed_at,
    });
  }

  opportunities.sort(sort === 'roi'
    ? (a, b) => b.roi_percent - a.roi_percent
    : (a, b) => b.net_profit - a.net_profit
  );

  return {
    mode: 'upgrade',
    opportunities: opportunities.slice(0, Number(limit)),
    total_found: opportunities.length,
    generated_at: new Date().toISOString(),
    tax_rate: taxRate,
  };
}

// ─── CONSUME FLIP ───
router.post('/consume', (req, res) => {
  const { item_id, origin_city, destination, net_profit } = req.body;
  if (!item_id || !origin_city || !destination) {
    return res.status(400).json({ error: 'item_id, origin_city, destination required' });
  }
  const db = getDb();
  const contributorId = resolveContributorId(db, req);

  db.prepare(`
    INSERT INTO consumed_flips (item_id, origin_city, destination, net_profit, contributor_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(item_id, origin_city, destination, net_profit || 0, contributorId);

  res.json({ ok: true });
});

// ─── ACTIVITY FEED ───
router.get('/activity', (req, res) => {
  const { limit = 20 } = req.query;
  const db = getDb();
  const rows = db.prepare(`
    SELECT cf.item_id, cf.origin_city, cf.destination, cf.net_profit, cf.consumed_at,
           COALESCE(c.name, 'Anônimo') AS contributor_name
    FROM consumed_flips cf
    LEFT JOIN contributors c ON c.id = cf.contributor_id
    ORDER BY cf.consumed_at DESC
    LIMIT ?
  `).all(Number(limit));

  res.json({ activity: rows });
});

// ─── MAIN ROUTER ───
router.get('/', (req, res) => {
  const db = getDb();
  const mode = req.query.mode || 'blackmarket';

  try {
    if (mode === 'upgrade') {
      res.json(flipUpgrade(db, req));
    } else {
      res.json(flipBlackMarket(db, req));
    }
  } catch (err) {
    console.error('[flipper] error:', err.message);
    res.status(500).json({ error: 'flipper error', detail: err.message });
  }
});

module.exports = router;
