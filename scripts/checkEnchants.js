const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = new Database(path.resolve(process.env.DB_PATH || './data/albion.db'));

const rows = db.prepare(`SELECT i.enchantment, COUNT(*) as c FROM market_prices mp JOIN items i ON i.unique_name=mp.item_unique_name WHERE mp.sell_price_min>0 GROUP BY i.enchantment ORDER BY i.enchantment`).all();
console.log('enchantments in market_prices:', rows);

const items = db.prepare(`SELECT unique_name, enchantment FROM items WHERE enchantment > 0 LIMIT 10`).all();
console.log('items with enchantment > 0:', items);

const prices_with_enchant = db.prepare(`SELECT mp.item_unique_name, i.enchantment, l.name, mp.sell_price_min FROM market_prices mp JOIN items i ON i.unique_name=mp.item_unique_name JOIN locations l ON l.id=mp.location_id WHERE i.enchantment > 0 AND mp.sell_price_min > 0 LIMIT 10`).all();
console.log('prices with enchant > 0:', prices_with_enchant);

db.close();
