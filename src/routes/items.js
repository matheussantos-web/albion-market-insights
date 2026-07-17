const express = require('express');
const { getDb } = require('../db/init');

const router = express.Router();

// GET /api/items?search=capuz&tier=4&category=Armas
router.get('/', (req, res) => {
  const db = getDb();
  const { search, tier, category, includeAll } = req.query;

  let query = 'SELECT unique_name, name_ptbr, tier, enchantment, category FROM items WHERE 1=1';
  const params = [];

  if (includeAll !== 'true') {
    query += ' AND tradeable = 1';
  }
  if (search) {
    query += ' AND (name_ptbr LIKE ? OR unique_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (tier) {
    query += ' AND tier = ?';
    params.push(Number(tier));
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY tier ASC, name_ptbr ASC LIMIT 200';
  res.json(db.prepare(query).all(...params));
});

// GET /api/items/categories — retorna categorias existentes com contagem
router.get('/categories', (req, res) => {
  const db = getDb();
  const includeAll = req.query.includeAll === 'true';
  const rows = db.prepare(
    `SELECT category, COUNT(*) as count FROM items
     WHERE category IS NOT NULL ${includeAll ? '' : 'AND tradeable = 1'}
     GROUP BY category ORDER BY count DESC`
  ).all();
  res.json(rows);
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
