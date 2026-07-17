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

function parseCategory(uniqueName) {
  const u = uniqueName.replace(/@\d$/, '');
  if (/^T\d_MAIN_SWORD/.test(u)) return 'Espadas';
  if (/^T\d_2H_DUALSWORD/.test(u)) return 'Espadas Duplas';
  if (/^T\d_MAIN_AXE/.test(u)) return 'Machados';
  if (/^T\d_2H_AXE/.test(u)) return 'Machados Duplos';
  if (/^T\d_MAIN_MACE/.test(u)) return 'Macas';
  if (/^T\d_2H_MACE/.test(u)) return 'Macas Duplas';
  if (/^T\d_MAIN_SPEAR/.test(u)) return 'Lancas';
  if (/^T\d_2H_SPEAR/.test(u)) return 'Lancas Duplas';
  if (/^T\d_MAIN_BOW/.test(u)) return 'Arcos';
  if (/^T\d_2H_BOW/.test(u)) return 'Arcos Recurvos';
  if (/^T\d_MAIN_CURSEDSTAFF/.test(u)) return 'Cajados Amaldicoados';
  if (/^T\d_2H_CURSEDSTAFF/.test(u)) return 'Cajados Amaldicoados Duplos';
  if (/^T\d_MAIN_HOLYSTAFF/.test(u)) return 'Cajados Sagrados';
  if (/^T\d_2H_HOLYSTAFF/.test(u)) return 'Cajados Sagrados Duplos';
  if (/^T\d_MAIN_FIRESTAFF/.test(u)) return 'Cajados de Fogo';
  if (/^T\d_2H_FIRESTAFF/.test(u)) return 'Cajados de Fogo Duplos';
  if (/^T\d_MAIN_ARCANESTAFF/.test(u)) return 'Cajados Arcanos';
  if (/^T\d_2H_ARCANESTAFF/.test(u)) return 'Cajados Arcanos Duplos';
  if (/^T\d_MAIN_NATURESTAFF/.test(u)) return 'Cajados da Natureza';
  if (/^T\d_2H_NATURESTAFF/.test(u)) return 'Cajados da Natureza Duplos';
  if (/^T\d_MAIN_DAGGER/.test(u)) return 'Adagas';
  if (/^T\d_2H_DAGGER/.test(u)) return 'Adagas Duplas';
  if (/^T\d_MAIN_QUARRELSTAFF/.test(u)) return 'Balestras';
  if (/^T\d_2H_QUARRELSTAFF/.test(u)) return 'Balestras Duplas';
  if (/^T\d_MAIN_CROSSBOW/.test(u)) return 'Bestas';
  if (/^T\d_2H_CROSSBOW/.test(u)) return 'Bestas Duplas';
  if (/^T\d_MAIN_TALISMAN/.test(u)) return 'Talismas';
  if (/^T\d_2H_TALISMAN/.test(u)) return 'Talismas Duplos';
  if (/^T\d_MAIN_ROCK/.test(u)) return 'Pedras';
  if (/^T\d_2H_ROCK/.test(u)) return 'Pedras Duplas';
  if (/^T\d_ARMOR_/?.test(u)) return 'Armaduras';
  if (/^T\d_2H_ARMOR_/.test(u)) return 'Armaduras Pesadas';
  if (/^T\d_HEAD_/.test(u)) return 'Capacetes';
  if (/^T\d_SHOES_/.test(u)) return 'Botas';
  if (/^T\d_ARMOR_.*_SET/.test(u)) return 'Conjuntos';
  if (/^T\d_BAG/.test(u)) return 'Bolsas';
  if (/^T\d_CAPE/.test(u)) return 'Capas';
  if (/^T\d_MOUNT_/.test(u)) return 'Montarias';
  if (/^T\d_FISH_/.test(u)) return 'Pesca';
  if (/^T\d_FOOD_/.test(u)) return 'Comida';
  if (/^T\d_POTION_/.test(u)) return 'Pocoes';
  if (/^T\d_GEM_/.test(u)) return 'Gemas';
  if (/^T\d_PLANK/.test(u)) return 'Pranchas';
  if (/^T\d_ORE/.test(u)) return 'Minerios';
  if (/^T\d_HIDE/.test(u)) return 'Couro';
  if (/^T\d_FIBER/.test(u)) return 'Fibras';
  if (/^T\d_CLOTH/.test(u)) return 'Tecidos';
  if (/^T\d_LEATHER/.test(u)) return 'Couro Trabalhado';
  if (/^T\d_METALBAR/.test(u)) return 'Barras de Metal';
  if (/^T\d_STONE/.test(u)) return 'Pedra';
  if (/^T\d_WOOD/.test(u)) return 'Madeira';
  if (/^UNIQUE_/?.test(u)) return 'Itens Unicos';
  if (/PLAYERISLAND_/.test(u)) return 'Decoracao';
  if (/FURNITUREITEM_/.test(u)) return 'Mobilha';
  return 'Outros';
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
        category: parseCategory(uniqueName),
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
