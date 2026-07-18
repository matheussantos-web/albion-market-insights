const express = require('express');
const { getDb } = require('../db/init');

const router = express.Router();

// GET /api/items?search=capuz&tier=4&category=Armas
router.get('/', (req, res) => {
  const db = getDb();
  const { search, tier, category, includeAll } = req.query;

  let query = `
    SELECT unique_name, name_ptbr, tier, enchantment, category FROM items WHERE 1=1
  `;
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

  query += ` UNION
    SELECT DISTINCT mp.item_unique_name as unique_name,
           mp.item_unique_name as name_ptbr,
           CAST(SUBSTR(mp.item_unique_name, 2, 1) AS INTEGER) as tier,
           0 as enchantment,
           'Dados Privados' as category
    FROM market_prices mp
    LEFT JOIN items i ON i.unique_name = mp.item_unique_name
    WHERE i.unique_name IS NULL AND mp.source = 'private'
  `;

  if (search) {
    query += ' AND (mp.item_unique_name LIKE ?)';
    params.push(`%${search}%`);
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

  const privCount = db.prepare(
    `SELECT COUNT(DISTINCT mp.item_unique_name) as count
     FROM market_prices mp LEFT JOIN items i ON i.unique_name = mp.item_unique_name
     WHERE i.unique_name IS NULL AND mp.source = 'private'`
  ).get();
  if (privCount.count > 0) rows.push({ category: 'Dados Privados', count: privCount.count });

  res.json(rows);
});

// GET /api/items/:uniqueName
router.get('/:uniqueName', (req, res) => {
  const db = getDb();
  let item = db
    .prepare('SELECT * FROM items WHERE unique_name = ?')
    .get(req.params.uniqueName);

  if (!item) {
    const hasData = db.prepare('SELECT 1 FROM market_prices WHERE item_unique_name = ? LIMIT 1').get(req.params.uniqueName);
    if (!hasData) return res.status(404).json({ error: 'item não encontrado' });
    item = {
      unique_name: req.params.uniqueName,
      name_ptbr: req.params.uniqueName,
      name_en: req.params.uniqueName,
      tier: Number(req.params.uniqueName.charAt(1)) || null,
      enchantment: 0,
      category: 'Dados Privados',
      tradeable: 1,
    };
  }
  res.json(item);
});

module.exports = router;
