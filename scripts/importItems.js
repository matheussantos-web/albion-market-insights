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

function parseItemBase(uniqueName) {
  return uniqueName
    .replace(/^T\d+_/, '')
    .replace(/@\d+$/, '');
}

function parseCategory(uniqueName) {
  const u = uniqueName.replace(/@\d$/, '');

  // ── Armas corpo a corpo ──
  if (/^T\d_(MAIN_SWORD|2H_DUALSWORD)/.test(u)) return 'Espadas';
  if (/^T\d_(MAIN_AXE|2H_AXE)/.test(u)) return 'Machados';
  if (/^T\d_(MAIN_MACE|2H_MACE)/.test(u)) return 'Macas';
  if (/^T\d_(MAIN_SPEAR|2H_SPEAR)/.test(u)) return 'Lancas';
  if (/^T\d_(MAIN_ROCK|2H_ROCK)/.test(u)) return 'Martelos';
  if (/^T\d_MAIN_HAMMER/.test(u)) return 'Martelos';
  if (/^T\d_2H_HAMMER/.test(u)) return 'Martelos';
  if (/^T\d_MAIN_CLAW/.test(u)) return 'Luvas de Guerra';
  if (/^T\d_2H_CLAW/.test(u)) return 'Luvas de Guerra';

  // ── Armas a distancia ──
  if (/^T\d_(MAIN_BOW|2H_BOW)/.test(u)) return 'Arcos';
  if (/^T\d_(MAIN_CROSSBOW|2H_CROSSBOW)/.test(u)) return 'Bestas';
  if (/^T\d_(MAIN_DAGGER|2H_DAGGER)/.test(u)) return 'Adagas';

  // ── Cajados (Mago) ──
  if (/^T\d_(MAIN_FIRESTAFF|2H_FIRESTAFF)/.test(u)) return 'Cajados de Fogo';
  if (/^T\d_(MAIN_HOLYSTAFF|2H_HOLYSTAFF)/.test(u)) return 'Cajados Sagrados';
  if (/^T\d_(MAIN_ARCANESTAFF|2H_ARCANESTAFF)/.test(u)) return 'Cajados Arcanos';
  if (/^T\d_(MAIN_FROSTSTAFF|2H_FROSTSTAFF)/.test(u)) return 'Cajados de Gelo';
  if (/^T\d_(MAIN_CURSEDSTAFF|2H_CURSEDSTAFF)/.test(u)) return 'Cajados Amaldicoados';
  if (/^T\d_(MAIN_NATURESTAFF|2H_NATURESTAFF)/.test(u)) return 'Cajados da Natureza';

  // ── Outras armas ──
  if (/^T\d_2H_QUARRELSTAFF/.test(u)) return 'Quarterstaffs';
  if (/^T\d_MAIN_QUARRELSTAFF/.test(u)) return 'Quarterstaffs';
  if (/^T\d_2H_TALISMAN/.test(u)) return 'Talismas';
  if (/^T\d_MAIN_TALISMAN/.test(u)) return 'Talismas';

  // ── Off-hand ──
  if (/^T\d_MAIN_SHIELD/.test(u)) return 'Escudos';
  if (/^T\d_2H_SHIELD/.test(u)) return 'Escudos';
  if (/^T\d_OFF_/.test(u)) return 'Escudos';
  if (/^T\d_MAIN_TORCH/.test(u)) return 'Tochas';
  if (/^T\d_MAIN_BOOK/.test(u)) return 'Livros';
  if (/^T\d_MAIN_HORN/.test(u)) return 'Chifres';
  if (/^T\d_MAIN_TOTEM/.test(u)) return 'Totens';
  if (/^T\d_MAIN_ORB/.test(u)) return 'Orbes';
  if (/^T\d_MAIN_RUNE/.test(u)) return 'Runas';
  if (/^T\d_MAIN_SCROLL/.test(u)) return 'Pergaminhos';

  // ── Armaduras (por slot) ──
  if (/^T\d_HEAD_PLATE/.test(u)) return 'Capacete de Placa';
  if (/^T\d_ARMOR_PLATE/.test(u)) return 'Armadura de Placa';
  if (/^T\d_SHOES_PLATE/.test(u)) return 'Botas de Placa';
  if (/^T\d_HEAD_LEATHER/.test(u)) return 'Capacete de Couro';
  if (/^T\d_ARMOR_LEATHER/.test(u)) return 'Armadura de Couro';
  if (/^T\d_SHOES_LEATHER/.test(u)) return 'Botas de Couro';
  if (/^T\d_HEAD_CLOTH/.test(u)) return 'Capacete de Tecido';
  if (/^T\d_ARMOR_CLOTH/.test(u)) return 'Armadura de Tecido';
  if (/^T\d_SHOES_CLOTH/.test(u)) return 'Botas de Tecido';
  if (/^T\d_ARMOR_/.test(u)) return 'Armaduras';
  if (/^T\d_HEAD_/.test(u)) return 'Capacetes';
  if (/^T\d_SHOES_/.test(u)) return 'Botas';

  // ── Acessorios ──
  if (/^T\d_BAG/.test(u)) return 'Bolsas';
  if (/^T\d_CAPE/.test(u)) return 'Capas';

  // ── Montarias ──
  if (/^T\d_MOUNT_/.test(u)) return 'Montarias';

  // ── Consumiveis ──
  if (/^T\d_POTION_/.test(u)) return 'Pocoes';
  if (/^T\d_FOOD_/.test(u)) return 'Comida';
  if (/^T\d_FISH_/.test(u)) return 'Pesca';

  // ── Recursos brutos ──
  if (/^T\d_ORE/.test(u)) return 'Minerio';
  if (/^T\d_WOOD/.test(u)) return 'Madeira';
  if (/^T\d_FIBER/.test(u)) return 'Fibra';
  if (/^T\d_HIDE/.test(u)) return 'Couro Bruto';
  if (/^T\d_STONE_/.test(u)) return 'Pedra';

  // ── Recursos refinados ──
  if (/^T\d_METALBAR/.test(u)) return 'Barra de Metal';
  if (/^T\d_PLANK/.test(u)) return 'Prancha';
  if (/^T\d_CLOTH/.test(u)) return 'Tecido';
  if (/^T\d_LEATHER/.test(u)) return 'Couro';
  if (/^T\d_STONEBLOCK/.test(u)) return 'Bloco de Pedra';

  // ── Ferramentas ──
  if (/^T\d_2H_TOOL_/.test(u)) return 'Ferramentas';
  if (/^T\d_MAIN_TOOL_/.test(u)) return 'Ferramentas';

  // ── Outros ──
  if (/^T\d_GEM_/.test(u)) return 'Gemas';
  if (/UNIQUE_/.test(u)) return 'Itens Unicos';
  if (/PLAYERISLAND_/.test(u)) return 'Decoracao';
  if (/FURNITUREITEM_/.test(u)) return 'Mobilha';
  return 'Outros';
}

const NON_TRADEABLE_CATEGORIES = new Set(['Itens Unicos', 'Mobilha', 'Decoracao', 'Outros']);

function isTradeable(category) {
  return !NON_TRADEABLE_CATEGORIES.has(category);
}

async function run() {
  console.log(`[import:items] baixando ${config.itemsJsonUrl} ...`);
  const res = await fetch(config.itemsJsonUrl);
  if (!res.ok) throw new Error(`falha ao baixar items.json: ${res.status} ${res.statusText}`);
  const raw = await res.json();

  const list = Array.isArray(raw) ? raw : raw.items?.item || Object.values(raw);

  const db = init();
  const upsert = db.prepare(`
    INSERT INTO items (unique_name, name_ptbr, name_en, tier, enchantment, category, tradeable, item_base)
    VALUES (@unique_name, @name_ptbr, @name_en, @tier, @enchantment, @category, @tradeable, @item_base)
    ON CONFLICT(unique_name) DO UPDATE SET
      name_ptbr = excluded.name_ptbr,
      name_en = excluded.name_en,
      tier = excluded.tier,
      enchantment = excluded.enchantment,
      category = excluded.category,
      tradeable = excluded.tradeable,
      item_base = excluded.item_base,
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
        tradeable: isTradeable(parseCategory(uniqueName)) ? 1 : 0,
        item_base: parseItemBase(uniqueName),
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
