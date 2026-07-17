const db = require('../src/db/init').getDb();
const locations = db.prepare('SELECT id, name FROM locations').all();
const bmCount = db.prepare("SELECT COUNT(*) as c FROM market_prices WHERE location_id = (SELECT id FROM locations WHERE name = 'Black Market')").get();
const total = db.prepare('SELECT COUNT(*) as c FROM market_prices').get();
const cityCounts = db.prepare('SELECT l.name, COUNT(*) as c FROM market_prices mp JOIN locations l ON l.id = mp.location_id GROUP BY l.name').all();
console.log('locations:', locations);
console.log('black market records:', bmCount);
console.log('total records:', total);
console.log('by city:', cityCounts);
