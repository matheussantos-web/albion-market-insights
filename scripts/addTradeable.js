const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = new Database(path.resolve(process.env.DB_PATH || './data/albion.db'));

try {
  db.exec("ALTER TABLE items ADD COLUMN tradeable INTEGER DEFAULT 1");
  console.log('[migrate] tradeable column added');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('[migrate] tradeable column already exists');
  } else {
    throw e;
  }
}

db.close();
