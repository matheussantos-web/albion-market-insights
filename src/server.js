require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');

const { init } = require('./db/init');
const itemsRouter = require('./routes/items');
const pricesRouter = require('./routes/prices');
const ingestRouter = require('./routes/ingest');
const adminRouter = require('./routes/admin');
const syncRouter = require('./routes/sync');
const authRouter = require('./routes/auth');
const newsRouter = require('./routes/news');
const marketRouter = require('./routes/market');
const flipperRouter = require('./routes/flipper');
const craftRouter = require('./routes/craft');

init();

const app = express();
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));

app.use('/api/items', itemsRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/sync', syncRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRouter);
app.use('/api/news', newsRouter);
app.use('/api/market', marketRouter);
app.use('/api/flipper', flipperRouter);
app.use('/api/craft', craftRouter);

app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// GET /api/stats — estatísticas gerais para dashboard
app.get('/api/stats', (req, res) => {
  const { getDb } = require('./db/init');
  const db = getDb();

  const totalItems = db.prepare('SELECT COUNT(*) as c FROM items').get().c;
  const totalPrices = db.prepare('SELECT COUNT(*) as c FROM market_prices').get().c;
  const privatePrices = db.prepare("SELECT COUNT(*) as c FROM market_prices WHERE source = 'private'").get().c;
  const publicPrices = db.prepare("SELECT COUNT(*) as c FROM market_prices WHERE source = 'public_adp'").get().c;
  const activeContributors = db.prepare("SELECT COUNT(DISTINCT contributor_id) as c FROM market_prices WHERE source = 'private'").get().c;
  const lastUpdate = db.prepare('SELECT MAX(observed_at) as t FROM market_prices').get().t;

  res.json({ totalItems, totalPrices, privatePrices, publicPrices, activeContributors, lastUpdate });
});

// GET /api/contributors/stats — lista de contribuidores com contagem de registros
app.get('/api/contributors/stats', (req, res) => {
  const { getDb } = require('./db/init');
  const db = getDb();

  const rows = db.prepare(`
    SELECT c.id, c.name as nickname, c.active, c.created_at, c.last_seen_at as last_seen,
           COUNT(mp.id) as record_count
    FROM contributors c
    LEFT JOIN market_prices mp ON mp.contributor_id = c.id
    GROUP BY c.id
    ORDER BY record_count DESC
  `).all();

  res.json(rows);
});

app.listen(config.port, () => {
  console.log(`Albion Market Insights rodando em http://localhost:${config.port}`);

  const SYNC_INTERVAL = 15 * 60 * 1000;
  async function autoSync() {
    try {
      const { syncPublicPrices } = require('./services/publicSync');
      const result = await syncPublicPrices();
      console.log(`[auto-sync] ${result.synced} registros sincronizados`);
    } catch (err) {
      console.error('[auto-sync] erro:', err.message);
    }
  }
  setInterval(autoSync, SYNC_INTERVAL);
  autoSync();
});
