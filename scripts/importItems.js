require('dotenv').config();
const fetch = require('node-fetch');
const { init } = require('../src/db/init');
const config = require('../src/config');

function parseTier(uniqueName) {
  const match = uniqueName.match(/^T(\d)_/);
  return match ? Number(match[1]) : null;
}

function parseEnchantment(uniqueName) {
  const match = uniqueName.match(/@(\d)$/);
  return match ? Number(match[1]) : 0;
}

async function run() {
  console.log(`[import:items] baixando ${config.itemsJsonUrl} ...`);
  const res = await fetch(config.itemsJsonUrl);
  if (!res.ok) throw new Error(`falha ao baixar items.json: ${res.status} ${res.statusText}`);
  const raw = await res.json();

  const list = Array.isArray(raw) ? raw : raw.items?.item || Object.values(raw);

  const db = init();
  const upsert = db.prepare(`
    INSERT INTO items (unique_name, name_ptbr, name_en, tier, enchantment, category)
    VALUES (@unique_name, @name_ptbr, @name_en, @tier, @enchantment, @category)
    ON CONFLICT(unique_name) DO UPDATE SET
      name_ptbr = excluded.name_ptbr,
      name_en = excluded.name_en,
      tier = excluded.tier,
      enchantment = excluded.enchantment,
      category = excluded.category,
      updated_at = datetime('now')
  `);

  const insertMany = db.transaction((items) => {
    let count = 0;
    for (const item of items) {
      const uniqueName = item.UniqueName;
      if (!uniqueName) continue;
      const localized = item.LocalizedNames || {};
      upsert.run({
        unique_name: uniqueName,
        name_ptbr: localized['PT-BR'] || uniqueName,
        name_en: localized['EN-US'] || uniqueName,
        tier: parseTier(uniqueName),
        enchantment: parseEnchantment(uniqueName),
        category: null,
      });
      count += 1;
    }
    return count;
  });

  const total = insertMany(list);
  console.log(`[import:items] ${total} itens importados/atualizados com sucesso.`);
}

run().catch((err) => {
  console.error('[import:items] erro:', err.message);
  process.exit(1);
});
