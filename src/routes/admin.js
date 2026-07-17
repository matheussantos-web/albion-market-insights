const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDb } = require('../db/init');
const { requireAdminSecret } = require('../middleware/auth');
const { syncPublicPrices } = require('../services/publicSync');

const router = express.Router();

// POST /api/admin/contributors { "name": "PC do Txaga" }
router.post('/contributors', requireAdminSecret, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });

  const db = getDb();
  const id = uuidv4();
  const apiKey = crypto.randomBytes(24).toString('hex');

  db.prepare('INSERT INTO contributors (id, name, api_key) VALUES (?, ?, ?)')
    .run(id, name, apiKey);

  res.status(201).json({ id, name, apiKey });
});

// GET /api/admin/contributors
router.get('/contributors', requireAdminSecret, (req, res) => {
  const db = getDb();
  res.json(
    db.prepare('SELECT id, name, active, created_at, last_seen_at FROM contributors').all()
  );
});

// PATCH /api/admin/contributors/:id/revoke
router.patch('/contributors/:id/revoke', requireAdminSecret, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE contributors SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/admin/watchlist { "itemId": "T4_BAG" }
router.post('/watchlist', requireAdminSecret, (req, res) => {
  const { itemId } = req.body;
  if (!itemId) return res.status(400).json({ error: 'itemId é obrigatório' });

  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO public_sync_watchlist (item_unique_name) VALUES (?)').run(itemId);
  res.status(201).json({ ok: true, itemId });
});

// GET /api/admin/watchlist
router.get('/watchlist', requireAdminSecret, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT item_unique_name, added_at FROM public_sync_watchlist').all());
});

// DELETE /api/admin/watchlist/:itemId
router.delete('/watchlist/:itemId', requireAdminSecret, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM public_sync_watchlist WHERE item_unique_name = ?').run(req.params.itemId);
  res.json({ ok: true });
});

// POST /api/admin/sync-public — dispara a sincronização com o AODP público na hora
router.post('/sync-public', requireAdminSecret, async (req, res) => {
  try {
    const result = await syncPublicPrices({ region: req.body?.region });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'falha ao sincronizar com AODP', detail: err.message });
  }
});

module.exports = router;
