require('dotenv').config();
const fetch = require('node-fetch');
const { init } = require('../src/db/init');
const config = require('../src/config');

async function run() {
  console.log(`[import:recipes] baixando ${config.itemsXmlUrl} ...`);
  const res = await fetch(config.itemsXmlUrl);
  if (!res.ok) throw new Error(`falha ao baixar items.xml: ${res.status} ${res.statusText}`);
  const xml = await res.text();
  console.log(`[import:recipes] XML baixado (${(xml.length / 1024 / 1024).toFixed(1)} MB)`);

  const ITEM_TAG_RE = /<(weapon|equipmentitem|simpleitem|consumableitem)\s[^>]*uniquename="([^"]+)"/g;
  const CRAFT_RE = /<craftingrequirements\s([^>]*?)>([\s\S]*?)<\/craftingrequirements>/g;
  const RESOURCE_RE = /<craftresource\s+uniquename="([^"]+)"\s+count="(\d+)"/g;

  const itemEvents = [];
  let m;
  while ((m = ITEM_TAG_RE.exec(xml)) !== null) {
    itemEvents.push({ pos: m.index, name: m[2] });
  }

  const craftEvents = [];
  CRAFT_RE.lastIndex = 0;
  while ((m = CRAFT_RE.exec(xml)) !== null) {
    craftEvents.push({ pos: m.index, attrs: m[1], inner: m[2] });
  }

  console.log(`[import:recipes] ${itemEvents.length} items, ${craftEvents.length} crafting blocks`);

  const recipes = new Map();
  let itemIdx = 0;

  for (const ce of craftEvents) {
    while (itemIdx < itemEvents.length - 1 && itemEvents[itemIdx + 1].pos < ce.pos) {
      itemIdx++;
    }
    if (itemIdx >= itemEvents.length) break;

    const itemName = itemEvents[itemIdx].name;

    const silverMatch = ce.attrs.match(/silver="(\d+)"/);
    const timeMatch = ce.attrs.match(/time="([\d.]+)"/);
    const silver = silverMatch ? parseInt(silverMatch[1], 10) : 0;
    const craftTime = timeMatch ? parseFloat(timeMatch[1]) : 0;

    RESOURCE_RE.lastIndex = 0;
    const resources = [];
    let rm;
    while ((rm = RESOURCE_RE.exec(ce.inner)) !== null) {
      resources.push({ resource: rm[1], count: parseInt(rm[2], 10) });
    }
    if (resources.length === 0) continue;

    if (recipes.has(itemName)) {
      const existing = recipes.get(itemName);
      if (existing.resources.length < resources.length) {
        recipes.set(itemName, { itemName, silver, craftTime, resources });
      }
    } else {
      recipes.set(itemName, { itemName, silver, craftTime, resources });
    }
  }

  console.log(`[import:recipes] ${recipes.size} recipes únicos`);

  const db = init();
  db.exec('DELETE FROM recipe_resources');
  db.exec('DELETE FROM recipes');

  const insertRecipe = db.prepare(`
    INSERT OR REPLACE INTO recipes (item_unique_name, silver_cost, craft_time)
    VALUES (?, ?, ?)
  `);
  const insertResource = db.prepare(`
    INSERT OR REPLACE INTO recipe_resources (item_unique_name, resource_unique_name, count)
    VALUES (?, ?, ?)
  `);

  const insertAll = db.transaction((list) => {
    for (const r of list) {
      insertRecipe.run(r.itemName, r.silver, r.craftTime);
      for (const res of r.resources) {
        insertResource.run(r.itemName, res.resource, res.count);
      }
    }
  });

  insertAll([...recipes.values()]);
  const totalResources = db.prepare('SELECT COUNT(*) as c FROM recipe_resources').get().c;
  console.log(`[import:recipes] ${recipes.size} recipes, ${totalResources} resource entries.`);
}

run().catch((err) => {
  console.error('[import:recipes] erro:', err.message);
  process.exit(1);
});
