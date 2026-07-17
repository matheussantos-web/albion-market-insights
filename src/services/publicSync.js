const fetch = require('node-fetch');
const { getDb } = require('../db/init');
const config = require('../config');

const REGIONS = {
  europe: 'https://europe.albion-online-data.com',
  west: 'https://west.albion-online-data.com',
  east: 'https://east.albion-online-data.com',
};

const CITIES = [
  'Caerleon', 'Bridgewatch', 'Lymhurst', 'Martlock', 'Fort Sterling', 'Thetford',
];

async function syncPublicPrices({ region = config.publicSyncRegion } = {}) {
  const base = REGIONS[region] || REGIONS.europe;
  const db = getDb();

  const watchlist = db.prepare('SELECT item_unique_name FROM public_sync_watchlist').all();
  if (watchlist.length === 0) {
    console.log('[publicSync] watchlist vazia — nada pra sincronizar.');
    return { synced: 0 };
  }

  const BATCH_SIZE = 50;
  const getLocationId = db.prepare('SELECT id FROM locations WHERE name = ?');
  const insertPrice = db.prepare(`
    INSERT INTO market_prices
      (item_unique_name, location_id, quality, sell_price_min, sell_price_max,
       buy_price_min, buy_price_max, observed_at, contributor_id, source)
    VALUES (@item_unique_name, @location_id, @quality, @sell_price_min, @sell_price_max,
            @buy_price_min, @buy_price_max, @observed_at, NULL, 'public_adp')
  `);

  const insertMany = db.transaction((entries) => {
    let count = 0;
    for (const row of entries) {
      if (!row.sell_price_min && !row.buy_price_min) continue;
      const location = getLocationId.get(row.city);
      if (!location) continue;
      insertPrice.run({
        item_unique_name: row.item_id,
        location_id: location.id,
        quality: row.quality ?? 1,
        sell_price_min: row.sell_price_min || null,
        sell_price_max: row.sell_price_max || null,
        buy_price_min: row.buy_price_min || null,
        buy_price_max: row.buy_price_max || null,
        observed_at: row.sell_price_min_date || row.buy_price_min_date || new Date().toISOString(),
      });
      count += 1;
    }
    return count;
  });

  let totalSynced = 0;
  for (let i = 0; i < watchlist.length; i += BATCH_SIZE) {
    const batch = watchlist.slice(i, i + BATCH_SIZE);
    const itemIds = batch.map((w) => w.item_unique_name);
    const url = `${base}/api/v2/stats/prices/${itemIds.join(',')}.json?locations=${CITIES.join(',')}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[publicSync] batch ${i / BATCH_SIZE + 1}: AODP respondeu ${res.status}`);
        continue;
      }
      const rows = await res.json();
      totalSynced += insertMany(rows);
    } catch (err) {
      console.error(`[publicSync] batch ${i / BATCH_SIZE + 1}: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[publicSync] ${totalSynced} registros públicos sincronizados (${watchlist.length} itens, região ${region}).`);
  return { synced: totalSynced };
}

async function fetchItemFromAodp(itemId, { region = config.publicSyncRegion } = {}) {
  const base = REGIONS[region] || REGIONS.europe;
  const db = getDb();

  db.prepare('INSERT OR IGNORE INTO public_sync_watchlist (item_unique_name) VALUES (?)').run(itemId);

  const getLocationId = db.prepare('SELECT id FROM locations WHERE name = ?');
  const insertPrice = db.prepare(`
    INSERT INTO market_prices
      (item_unique_name, location_id, quality, sell_price_min, sell_price_max,
       buy_price_min, buy_price_max, observed_at, contributor_id, source)
    VALUES (@item_unique_name, @location_id, @quality, @sell_price_min, @sell_price_max,
            @buy_price_min, @buy_price_max, @observed_at, NULL, 'public_adp')
  `);

  const url = `${base}/api/v2/stats/prices/${itemId}.json?locations=${CITIES.join(',')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`AODP respondeu ${res.status} ${res.statusText}`);
  const rows = await res.json();

  const insertMany = db.transaction((entries) => {
    let count = 0;
    for (const row of entries) {
      if (!row.sell_price_min && !row.buy_price_min) continue;
      const location = getLocationId.get(row.city);
      if (!location) continue;
      insertPrice.run({
        item_unique_name: row.item_id,
        location_id: location.id,
        quality: row.quality ?? 1,
        sell_price_min: row.sell_price_min || null,
        sell_price_max: row.sell_price_max || null,
        buy_price_min: row.buy_price_min || null,
        buy_price_max: row.buy_price_max || null,
        observed_at: row.sell_price_min_date || row.buy_price_min_date || new Date().toISOString(),
      });
      count += 1;
    }
    return count;
  });

  return insertMany(rows);
}

module.exports = { syncPublicPrices, fetchItemFromAodp, REGIONS };
