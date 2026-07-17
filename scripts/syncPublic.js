require('dotenv').config();
const { init } = require('../src/db/init');
const { syncPublicPrices } = require('../src/services/publicSync');
const config = require('../src/config');

init();

syncPublicPrices({ region: config.publicSyncRegion })
  .then(({ synced }) => {
    console.log(`OK — ${synced} preços públicos atualizados.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[sync:public] erro:', err.message);
    process.exit(1);
  });
