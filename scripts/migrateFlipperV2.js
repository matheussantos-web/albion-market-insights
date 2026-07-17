const path = require('path');
const Database = require('better-sqlite3');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DB_PATH = process.env.DB_PATH || './data/albion.db';
const db = new Database(path.resolve(DB_PATH));
db.pragma('journal_mode = WAL');

console.log('[migrate] Flipper v2 migration starting...');

db.exec(`
  CREATE TABLE IF NOT EXISTS consumed_flips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    origin_city TEXT NOT NULL,
    destination TEXT NOT NULL,
    net_profit INTEGER,
    consumed_at TEXT DEFAULT (datetime('now')),
    contributor_id TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_consumed_flips_at ON consumed_flips(consumed_at);

  CREATE TABLE IF NOT EXISTS upgrade_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tier INTEGER NOT NULL,
    from_enchant INTEGER NOT NULL,
    to_enchant INTEGER NOT NULL,
    material_name TEXT NOT NULL,
    material_cost INTEGER NOT NULL,
    UNIQUE(tier, from_enchant, to_enchant)
  );
`);

const insertCost = db.prepare(`
  INSERT OR IGNORE INTO upgrade_costs (tier, from_enchant, to_enchant, material_name, material_cost)
  VALUES (?, ?, ?, ?, ?)
`);

const costs = [
  // T3: +0 → +1 (Runas de t3 = ~500)
  [3, 0, 1, 'Runa T3', 500],
  // T4: +0 → +1 (Runas de t4 = ~2000)
  [4, 0, 1, 'Runa T4', 2000],
  // T5: +0 → +1 (Runas de t5 = ~8000)
  [5, 0, 1, 'Runa T5', 8000],
  // T6: +0 → +1 (Almas de t6 = ~30000)
  [6, 0, 1, 'Alma T6', 30000],
  // T7: +0 → +1 (Almas de t7 = ~120000)
  [7, 0, 1, 'Alma T7', 120000],
  // T8: +0 → +1 (Relíquias de t8 = ~500000)
  [8, 0, 1, 'Relíquia T8', 500000],

  // T6: +1 → +2 (Relíquias de t6 = ~50000)
  [6, 1, 2, 'Relíquia T6', 50000],
  // T7: +1 → +2 (Relíquias de t7 = ~200000)
  [7, 1, 2, 'Relíquia T7', 200000],
  // T8: +1 → +2 (Relíquias de t8 = ~800000)
  [8, 1, 2, 'Relíquia T8', 800000],

  // T8: +2 → +3 (Relíquias de t8 = ~1200000)
  [8, 2, 3, 'Relíquia T8', 1200000],
];

const tx = db.transaction(() => {
  for (const c of costs) {
    insertCost.run(...c);
  }
});
tx();

console.log(`[migrate] inserted ${costs.length} upgrade costs`);
console.log('[migrate] Flipper v2 migration done');
db.close();
