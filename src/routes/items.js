const express = require('express');
const { getDb } = require('../db/init');

const router = express.Router();

// GET /api/items?search=capuz&tier=4
router.get('/', (req, res) => {
  const db = getDb();
  const { search, tier } = req.query;

  let query = 'SELECT unique_name, name_ptbr, tier, enchantment, category FROM items WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND name_ptbr LIKE ?';
    params.push(`%${search}%`);
  }
  if (tier) {
    query += ' AND tier = ?';
    params.push(Number(tier));
  }

  query += ' LIMIT 200';
  res.json(db.prepare(query).all(...params));
});

// GET /api/items/:uniqueName
router.get('/:uniqueName', (req, res) => {
  const db = getDb();
  const item = db
    .prepare('SELECT * FROM items WHERE unique_name = ?')
    .get(req.params.uniqueName);

  if (!item) return res.status(404).json({ error: 'item não encontrado' });
  res.json(item);
});

module.exports = router;
