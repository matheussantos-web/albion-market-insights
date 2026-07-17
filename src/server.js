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

init();

const app = express();
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));

app.use('/api/items', itemsRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/sync', syncRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/admin', adminRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(config.port, () => {
  console.log(`Albion Market Insights rodando em http://localhost:${config.port}`);
});
