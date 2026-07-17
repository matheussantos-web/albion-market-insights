const db = require('../src/db/init').getDb();
console.log('total:', db.prepare('SELECT COUNT(*) as c FROM market_prices').get().c);
console.log('unique items:', db.prepare('SELECT COUNT(DISTINCT item_unique_name) as c FROM market_prices').get().c);
console.log('24h:', db.prepare("SELECT COUNT(*) as c FROM market_prices WHERE observed_at >= datetime('now','-1 day')").get().c);
console.log('7d:', db.prepare("SELECT COUNT(*) as c FROM market_prices WHERE observed_at >= datetime('now','-7 day')").get().c);
console.log('cities:', db.prepare('SELECT l.name, COUNT(*) as c FROM market_prices mp JOIN locations l ON l.id=mp.location_id GROUP BY l.name').all());
console.log('sample:', db.prepare("SELECT item_unique_name, sell_price_min, observed_at FROM market_prices ORDER BY observed_at DESC LIMIT 3").all());
