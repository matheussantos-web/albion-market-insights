require('dotenv').config();
const { init } = require('../src/db/init');
const { fetchItemFromAodp } = require('../src/services/publicSync');

async function run() {
  const db = init();
  const watchlist = db.prepare('SELECT item_unique_name FROM public_sync_watchlist').all();
  console.log(`[batch-sync] ${watchlist.length} itens na watchlist`);

  let totalSynced = 0;
  let errors = 0;

  for (const { item_unique_name } of watchlist) {
    try {
      const count = await fetchItemFromAodp(item_unique_name);
      totalSynced += count;
      if (count > 0) {
        process.stdout.write(`  ${item_unique_name}: ${count} registros\r`);
      }
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`\n  ERRO em ${item_unique_name}: ${err.message}`);
      }
    }
  }

  console.log(`\n[batch-sync] concluído: ${totalSynced} registros, ${errors} erros`);
}

run().catch(err => {
  console.error('[batch-sync] fatal:', err.message);
  process.exit(1);
});
