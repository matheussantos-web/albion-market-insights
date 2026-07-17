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
}

module.exports = { getDb, init };
