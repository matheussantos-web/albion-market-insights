const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(process.env.DB_PATH || './data/albion.db');
console.log('db path:', dbPath);
const db = new Database(dbPath);
try {
  const cols = db.prepare('PRAGMA table_info(items)').all();
  console.log('items columns:', cols.map(c => c.name));
} catch(e) {
  console.error('items table error:', e.message);
}
try {
  const count = db.prepare('SELECT count(*) as c FROM items').get();
  console.log('items count:', count.c);
} catch(e) {
  console.error('items select error:', e.message);
}
db.close();
