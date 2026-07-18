const db = require('./src/db/init').getDb();
const fks = db.pragma('foreign_key_list(market_prices)');
console.log('FKs:', JSON.stringify(fks));
const cols = db.pragma('table_info(market_prices)');
console.log('Columns:', cols.map(c => c.name).join(', '));
const count = db.prepare('SELECT COUNT(*) as n FROM market_prices').get();
console.log('Rows:', count.n);
