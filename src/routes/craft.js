const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');

router.get('/recipe/:uniqueName', (req, res) => {
  const db = getDb();
  const { uniqueName } = req.params;

  let recipe = db.prepare('SELECT * FROM recipes WHERE item_unique_name = ?').get(uniqueName);
  let recipeLevel = recipe ? 'direct' : null;

  if (!recipe) {
    const atIdx = uniqueName.lastIndexOf('@');
    if (atIdx > 0) {
      const baseName = uniqueName.substring(0, atIdx);
      recipe = db.prepare('SELECT * FROM recipes WHERE item_unique_name = ?').get(baseName);
      if (recipe) recipeLevel = 'base';
    }
  }

  if (!recipe) {
    return res.json({ recipe: null, resources: [], recipe_level: null });
  }

  const resources = db.prepare(`
    SELECT rr.resource_unique_name, rr.count, i.name_ptbr, i.name_en, i.tier, i.enchantment, i.category
    FROM recipe_resources rr
    LEFT JOIN items i ON i.unique_name = rr.resource_unique_name
    WHERE rr.item_unique_name = ?
  `).all(recipe.item_unique_name);

  res.json({ recipe, resources, recipe_level: recipeLevel });
});

router.get('/has-recipe/:uniqueName', (req, res) => {
  const db = getDb();
  const { uniqueName } = req.params;

  const hasDirect = db.prepare('SELECT 1 FROM recipes WHERE item_unique_name = ?').get(uniqueName);
  if (hasDirect) return res.json({ has_recipe: true, level: 'direct' });

  const atIdx = uniqueName.lastIndexOf('@');
  if (atIdx > 0) {
    const baseName = uniqueName.substring(0, atIdx);
    const hasBase = db.prepare('SELECT 1 FROM recipes WHERE item_unique_name = ?').get(baseName);
    if (hasBase) return res.json({ has_recipe: true, level: 'base' });
  }

  return res.json({ has_recipe: false, level: null });
});

router.get('/search', (req, res) => {
  const db = getDb();
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  const rows = db.prepare(`
    SELECT r.item_unique_name, i.name_ptbr, i.name_en, i.tier, i.enchantment, i.category, i.tradeable
    FROM recipes r
    LEFT JOIN items i ON i.unique_name = r.item_unique_name
    WHERE r.item_unique_name LIKE ? OR i.name_ptbr LIKE ? OR i.name_en LIKE ?
    ORDER BY i.tier DESC, r.item_unique_name
    LIMIT 30
  `).all(`%${q}%`, `%${q}%`, `%${q}%`);

  res.json(rows);
});

module.exports = router;
