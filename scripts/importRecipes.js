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

  const ITEM_CLOSE_RE = /<\/(weapon|equipmentitem|simpleitem|consumableitem)>/g;
  const ITEM_TAG_RE = /<(weapon|equipmentitem|simpleitem|consumableitem)\s[^>]*uniquename="([^"]+)"/g;
  const CRAFT_RE = /<craftingrequirements\s([^>]*?)>([\s\S]*?)<\/craftingrequirements>/g;
  const RESOURCE_RE = /<craftresource[^>]*uniquename="([^"]+)"[^>]*count="(\d+)"/g;
  const ENCH_RE = /<enchantment\s+enchantmentlevel="(\d+)"/g;

  const itemEvents = [];
  let m;
  while ((m = ITEM_TAG_RE.exec(xml)) !== null) {
    itemEvents.push({ pos: m.index, end: -1, name: m[2], tag: m[1] });
  }

  const closeEvents = [];
  ITEM_CLOSE_RE.lastIndex = 0;
  while ((m = ITEM_CLOSE_RE.exec(xml)) !== null) {
    closeEvents.push({ pos: m.index });
  }

  for (const item of itemEvents) {
    const closing = closeEvents.find(c => c.pos > item.pos);
    item.end = closing ? closing.pos : xml.length;
  }

  console.log(`[import:recipes] ${itemEvents.length} items`);

  const recipes = new Map();

  for (const item of itemEvents) {
    const itemXml = xml.substring(item.pos, item.end);
    const itemName = item.name;

    const enchantBlocks = [];
    ENCH_RE.lastIndex = 0;
    let em;
    while ((em = ENCH_RE.exec(itemXml)) !== null) {
      enchantBlocks.push({ level: parseInt(em[1], 10), pos: em.index });
    }

    if (enchantBlocks.length > 0) {
      const topCraftIdx = itemXml.indexOf('<craftingrequirements');
      const firstEnchIdx = enchantBlocks[0].pos;

      if (topCraftIdx >= 0 && topCraftIdx < firstEnchIdx) {
        const blockEnd = itemXml.indexOf('</craftingrequirements>', topCraftIdx);
        if (blockEnd >= 0) {
          const craftXml = itemXml.substring(topCraftIdx, blockEnd + '</craftingrequirements>'.length);
          extractRecipe(recipes, itemName, craftXml);
        }
      }

      for (let i = 0; i < enchantBlocks.length; i++) {
        const ench = enchantBlocks[i];
        const enchEnd = i < enchantBlocks.length - 1 ? enchantBlocks[i + 1].pos : itemXml.length;
        const enchBlock = itemXml.substring(ench.pos, enchEnd);

        const craftIdx = enchBlock.indexOf('<craftingrequirements');
        if (craftIdx < 0) continue;

        const craftEnd = enchBlock.indexOf('</craftingrequirements>', craftIdx);
        if (craftEnd < 0) continue;

        const craftXml = enchBlock.substring(craftIdx, craftEnd + '</craftingrequirements>'.length);

        let enchItemName;
        if (itemName.includes('_AVALON') || itemName.includes('_HELL') || itemName.includes('_KEEPER') || itemName.includes('_MORGANA') || itemName.includes('_UNDEAD') || itemName.includes('_CRYSTAL') || itemName.includes('_FEY')) {
          enchItemName = `${itemName}@${ench.level}`;
        } else {
          enchItemName = `${itemName}_LEVEL${ench.level}@${ench.level}`;
        }

        extractRecipe(recipes, enchItemName, craftXml);
      }
    } else {
      const craftIdx = itemXml.indexOf('<craftingrequirements');
      if (craftIdx < 0) continue;

      const craftEnd = itemXml.indexOf('</craftingrequirements>', craftIdx);
      if (craftEnd < 0) continue;

      const craftXml = itemXml.substring(craftIdx, craftEnd + '</craftingrequirements>'.length);
      extractRecipe(recipes, itemName, craftXml);
    }
  }

  console.log(`[import:recipes] ${recipes.size} recipes (base + enchantment levels)`);

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

  const enchRecipes = db.prepare(`SELECT COUNT(*) as c FROM recipes WHERE item_unique_name LIKE '%@%' OR item_unique_name LIKE '%_LEVEL%'`).get().c;
  console.log(`[import:recipes] ${enchRecipes} enchantment-level recipes`);

  const avalonRecipes = db.prepare(`SELECT COUNT(*) as c FROM recipes WHERE item_unique_name LIKE '%@1' OR item_unique_name LIKE '%@2' OR item_unique_name LIKE '%@3' OR item_unique_name LIKE '%@4'`).get().c;
  console.log(`[import:recipes] ${avalonRecipes} recipes with @1-@4 enchantments`);
}

function extractRecipe(recipes, itemName, craftXml) {
  const RESOURCE_RE = /<craftresource[^>]*uniquename="([^"]+)"[^>]*count="(\d+)"/g;
  const silverMatch = craftXml.match(/silver="(\d+)"/);
  const timeMatch = craftXml.match(/time="([\d.]+)"/);
  const silver = silverMatch ? parseInt(silverMatch[1], 10) : 0;
  const craftTime = timeMatch ? parseFloat(timeMatch[1]) : 0;

  RESOURCE_RE.lastIndex = 0;
  const resources = [];
  let rm;
  while ((rm = RESOURCE_RE.exec(craftXml)) !== null) {
    resources.push({ resource: rm[1], count: parseInt(rm[2], 10) });
  }
  if (resources.length === 0) return;

  if (recipes.has(itemName)) {
    const existing = recipes.get(itemName);
    if (existing.resources.length < resources.length) {
      recipes.set(itemName, { itemName, silver, craftTime, resources });
    }
  } else {
    recipes.set(itemName, { itemName, silver, craftTime, resources });
  }
}

run().catch((err) => {
  console.error('[import:recipes] erro:', err.message);
  process.exit(1);
});
