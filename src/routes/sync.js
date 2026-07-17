const express = require('express');
const { fetchItemFromAodp, syncPublicPrices } = require('../services/publicSync');
const { fetchRateLimit } = require('../middleware/rateLimit');
const config = require('../config');

const router = express.Router();

router.post('/watchlist-sync', async (req, res) => {
  try {
    const region = req.query.region || config.publicSyncRegion;
    const result = await syncPublicPrices({ region });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'falha ao sincronizar watchlist', detail: err.message });
  }
});

router.post('/:uniqueName/fetch', fetchRateLimit, async (req, res) => {
  try {
    const region = req.query.region || config.publicSyncRegion;
    const inserted = await fetchItemFromAodp(req.params.uniqueName, { region });
    res.json({ fetched: inserted, region });
  } catch (err) {
    res.status(502).json({ error: 'falha ao buscar do AODP', detail: err.message });
  }
});

module.exports = router;
