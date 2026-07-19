const fetch = require('node-fetch');
const { getDb } = require('../db/init');
const config = require('../config');

const REGIONS = {
  europe: 'https://europe.albion-online-data.com',
  west: 'https://west.albion-online-data.com',
  east: 'https://east.albion-online-data.com',
};

const CITIES = [
  'Caerleon', 'Bridgewatch', 'Lymhurst', 'Martlock', 'Fort Sterling', 'Thetford', 'Black Market',
];

const INSERT_SQL = `
  INSERT INTO market_prices
    (item_unique_name, location_id, quality, sell_price_min, sell_price_max,
     buy_price_min, buy_price_max, observed_at, contributor_id, source)
  SELECT @item_unique_name, @location_id, @quality, @sell_price_min, @sell_price_max,
         @buy_price_min, @buy_price_max, @observed_at, NULL, 'public_adp'
  WHERE NOT EXISTS (
    SELECT 1 FROM market_prices mp3
    WHERE mp3.item_unique_name = @item_unique_name
      AND mp3.location_id = @location_id
      AND mp3.quality = @quality
      AND mp3.observed_at >= @observed_at
  )
`;

const SENTINELS = new Set([999999, 1000000, 8999999, 9999999, 1499999, 99999999, 2147483647, 0]);
const MAX_PRICE = 50000000;

function isSentinel(v) {
  if (!v || v <= 0) return true;
  if (SENTINELS.has(v)) return true;
  if (v > MAX_PRICE) return true;
  return false;
}

function looksUnderscaled(price) {
  if (!price || price <= 0) return false;
  return price < 100;
}

function buildInsertFn(db) {
  const getLocationId = db.prepare('SELECT id FROM locations WHERE name = ?');
  const insertPrice = db.prepare(INSERT_SQL);

  const insertMany = db.transaction((entries) => {
    let count = 0;
    let rejected = 0;
    for (const row of entries) {
      if (!row.sell_price_min && !row.buy_price_min) continue;

      if (isSentinel(row.sell_price_min)) { rejected++; continue; }

      if (looksUnderscaled(row.sell_price_min) || looksUnderscaled(row.buy_price_min)) {
        console.warn(`[publicSync] PRICE_ANOMALY: item=${row.item_id} city=${row.city} sell=${row.sell_price_min} buy=${row.buy_price_min}`);
      }

      const location = getLocationId.get(row.city);
      if (!location) continue;
      insertPrice.run({
        item_unique_name: row.item_id,
        location_id: location.id,
        quality: row.quality ?? 1,
        sell_price_min: row.sell_price_min || null,
        sell_price_max: isSentinel(row.sell_price_max) ? null : row.sell_price_max || null,
        buy_price_min: isSentinel(row.buy_price_min) ? null : row.buy_price_min || null,
        buy_price_max: isSentinel(row.buy_price_max) ? null : row.buy_price_max || null,
        observed_at: row.sell_price_min_date || row.buy_price_min_date || new Date().toISOString(),
      });
      count += 1;
    }
    if (rejected > 0) console.log(`[publicSync] ${rejected} registros rejeitados (sentinel/default values)`);
    return count;
  });

  return insertMany;
}

async function syncPublicPrices({ region = config.publicSyncRegion } = {}) {
  const base = REGIONS[region] || REGIONS.europe;
  const db = getDb();

  const watchlist = db.prepare('SELECT item_unique_name FROM public_sync_watchlist').all();
  if (watchlist.length === 0) {
    console.log('[publicSync] watchlist vazia — nada pra sincronizar.');
    return { synced: 0 };
  }

  const BATCH_SIZE = 50;
  const insertMany = buildInsertFn(db);

  let totalSynced = 0;
  for (let i = 0; i < watchlist.length; i += BATCH_SIZE) {
    const batch = watchlist.slice(i, i + BATCH_SIZE);
    const itemIds = batch.map((w) => w.item_unique_name);
    const url = `${base}/api/v2/stats/prices/${itemIds.join(',')}.json?locations=${CITIES.join(',')}`;

    try {
      const res = await fetch(url, { timeout: AODP_TIMEOUT_MS });
      if (!res.ok) {
        _aodpDownUntil = Date.now() + AODP_COOLDOWN_MS;
        console.error(`[publicSync] batch ${i / BATCH_SIZE + 1}: AODP respondeu ${res.status}`);
        continue;
      }
      const rows = await res.json();
      totalSynced += insertMany(rows);
    } catch (err) {
      _aodpDownUntil = Date.now() + AODP_COOLDOWN_MS;
      console.error(`[publicSync] batch ${i / BATCH_SIZE + 1}: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[publicSync] ${totalSynced} registros públicos sincronizados (${watchlist.length} itens, região ${region}).`);
  return { synced: totalSynced };
}

let _aodpDownUntil = 0;
const AODP_COOLDOWN_MS = 60000;
const AODP_TIMEOUT_MS = 8000;

async function fetchItemFromAodp(itemId, { region = config.publicSyncRegion } = {}) {
  if (Date.now() < _aodpDownUntil) {
    throw new Error('AODP marcado como indisponível, ignorando por 60s');
  }

  const base = REGIONS[region] || REGIONS.europe;
  const db = getDb();

  db.prepare('INSERT OR IGNORE INTO public_sync_watchlist (item_unique_name) VALUES (?)').run(itemId);
  const insertMany = buildInsertFn(db);

  const url = `${base}/api/v2/stats/prices/${itemId}.json?locations=${CITIES.join(',')}`;
  const res = await fetch(url, { timeout: AODP_TIMEOUT_MS });
  if (!res.ok) {
    _aodpDownUntil = Date.now() + AODP_COOLDOWN_MS;
    throw new Error(`AODP respondeu ${res.status} ${res.statusText}`);
  }
  const rows = await res.json();

  return insertMany(rows);
}

module.exports = { syncPublicPrices, fetchItemFromAodp, refreshStaleItems, REGIONS };

async function refreshStaleItems(limit = 50) {
  const db = getDb();
  const staleItems = db.prepare(`
    SELECT DISTINCT item_unique_name FROM market_prices
    WHERE source = 'public_adp'
      AND item_unique_name IN (
        SELECT item_unique_name FROM market_prices
        GROUP BY item_unique_name
        HAVING MAX(observed_at) < datetime('now', '-1 hour')
      )
    LIMIT ?
  `).all(limit);

  if (staleItems.length === 0) return;

  console.log(`[refreshStaleItems] revalidando ${staleItems.length} itens...`);
  for (const { item_unique_name } of staleItems) {
    try {
      await fetchItemFromAodp(item_unique_name);
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[refreshStaleItems] falha em ${item_unique_name}: ${err.message}`);
    }
  }
}
