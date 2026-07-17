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
  console.log(`[db] schema aplicado em ${DB_PATH}`);
  return database;
}

module.exports = { getDb, init };
