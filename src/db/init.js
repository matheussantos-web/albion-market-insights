const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './data/albion.db';

let db;

function getDb() {
  if (!db) {
    const resolved = path.resolve(DB_PATH);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    db = new Database(resolved);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function init() {
  const database = getDb();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  database.exec(schema);
  runMigrations(database);
  console.log(`[db] schema aplicado em ${DB_PATH}`);
  return database;
}

function runMigrations(database) {
  const cols = database.prepare("PRAGMA table_info(contributors)").all();
  if (!cols.find(c => c.name === 'user_id')) {
    database.exec('ALTER TABLE contributors ADD COLUMN user_id INTEGER');
    database.exec('CREATE INDEX IF NOT EXISTS idx_contributors_user ON contributors(user_id)');
    console.log('[db] migration: user_id added to contributors');
  }

  // Migration: remove FK on item_unique_name to accept any item ID from game
  const fks = database.prepare("PRAGMA foreign_key_list(market_prices)").all();
  const hasItemFk = fks.some(f => f.from === 'item_unique_name');
  if (hasItemFk) {
    console.log('[db] migration: removing FK on market_prices.item_unique_name...');
    database.pragma('foreign_keys = OFF');
    database.exec(`
      CREATE TABLE IF NOT EXISTS market_prices_new (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        item_unique_name TEXT NOT NULL,
        location_id   INTEGER NOT NULL,
        quality       INTEGER DEFAULT 1,
        sell_price_min INTEGER,
        sell_price_max INTEGER,
        buy_price_min  INTEGER,
        buy_price_max  INTEGER,
        observed_at    TEXT NOT NULL,
        ingested_at    TEXT DEFAULT (datetime('now')),
        contributor_id TEXT,
        source         TEXT NOT NULL DEFAULT 'private',
        FOREIGN KEY (location_id) REFERENCES locations(id)
      );
      INSERT INTO market_prices_new SELECT * FROM market_prices;
      DROP TABLE market_prices;
      ALTER TABLE market_prices_new RENAME TO market_prices;
    `);
    database.exec('CREATE INDEX IF NOT EXISTS idx_prices_item ON market_prices(item_unique_name)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_prices_location ON market_prices(location_id)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_prices_observed ON market_prices(observed_at)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_prices_source ON market_prices(source)');
    database.pragma('foreign_keys = ON');
    console.log('[db] migration: FK removed, indexes recreated');
  }

  // Migration: add item_base column
  const itemCols = database.prepare("PRAGMA table_info(items)").all();
  if (!itemCols.find(c => c.name === 'item_base')) {
    database.exec('ALTER TABLE items ADD COLUMN item_base TEXT');
    database.exec('CREATE INDEX IF NOT EXISTS idx_items_base ON items(item_base)');
    console.log('[db] migration: item_base added to items');
  }
}

module.exports = { getDb, init };
