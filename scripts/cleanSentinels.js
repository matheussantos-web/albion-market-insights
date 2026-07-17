const db = require('../src/db/init').getDb();

const SENTINELS = [999999, 1000000, 9999999, 99999999, 2147483647];
const MAX_PRICE = 50000000;

const before = db.prepare('SELECT COUNT(*) as c FROM market_prices').get().c;

for (const val of SENTINELS) {
  const r = db.prepare('DELETE FROM market_prices WHERE sell_price_min = ?').run(val);
  if (r.changes) console.log(`Removidos ${r.changes} registros com sell_price_min = ${val}`);
}

const r2 = db.prepare(`DELETE FROM market_prices WHERE sell_price_min > ${MAX_PRICE}`).run();
if (r2.changes) console.log(`Removidos ${r2.changes} registros com sell_price_min > ${MAX_PRICE}`);

const r3 = db.prepare(`DELETE FROM market_prices WHERE sell_price_max > ${MAX_PRICE}`).run();
if (r3.changes) console.log(`Removidos ${r3.changes} registros com sell_price_max > ${MAX_PRICE}`);

const r4 = db.prepare(`DELETE FROM market_prices WHERE buy_price_min > ${MAX_PRICE}`).run();
if (r4.changes) console.log(`Removidos ${r4.changes} registros com buy_price_min > ${MAX_PRICE}`);

const r5 = db.prepare(`DELETE FROM market_prices WHERE buy_price_max > ${MAX_PRICE}`).run();
if (r5.changes) console.log(`Removidos ${r5.changes} registros com buy_price_max > ${MAX_PRICE}`);

const after = db.prepare('SELECT COUNT(*) as c FROM market_prices').get().c;
console.log(`Limpeza concluída: ${before} → ${after} registros (${before - after} removidos)`);
