#!/usr/bin/env node

const AONetwork = require('ao-network');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// ── Config ──
const exeDir = process.pkg ? path.dirname(process.execPath) : __dirname;
const configPath = path.join(exeDir, 'config.json');

function log(msg) { console.log(`[ami-client] ${msg}`); }
function logError(msg) { console.error(`[ami-client] ERRO: ${msg}`); }

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      server: 'http://191.252.219.229:3000',
      apiKey: 'COLE_SUA_API_KEY_AQUI',
      name: 'Meu PC',
      batchInterval: 5000,
      maxBatchSize: 100
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    log(`Config criado em: ${configPath}`);
    log('Edite o arquivo config.json com sua API key e reinicie.');
    process.exit(0);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config.apiKey || config.apiKey === 'COLE_SUA_API_KEY_AQUI') {
    logError('API key não configurada!');
    log(`Edite: ${configPath}`);
    process.exit(1);
  }
  return config;
}

// ── City detection ──
// Albion city IDs from the game's cluster data
const CITY_IDS = {
  'CITY_CAERLEON': 'Caerleon',
  'CITY_BRIDGEWATCH': 'Bridgewatch',
  'CITY_LYMHURST': 'Lymhurst',
  'CITY_MARTLOCK': 'Martlock',
  'CITY_FORT_STERLING': 'Fort Sterling',
  'CITY_THETFORD': 'Thetford',
};

// City name patterns that might appear in cluster data
const CITY_PATTERNS = [
  { pattern: /caerleon/i, city: 'Caerleon' },
  { pattern: /bridgewatch/i, city: 'Bridgewatch' },
  { pattern: /lymhurst/i, city: 'Lymhurst' },
  { pattern: /martlock/i, city: 'Martlock' },
  { pattern: /fort.sterling/i, city: 'Fort Sterling' },
  { pattern: /thetford/i, city: 'Thetford' },
  { pattern: /black.market/i, city: 'Black Market' },
];

function detectCity(params) {
  // Try to detect city from event parameters
  for (const key of Object.keys(params)) {
    const val = params[key];
    if (typeof val === 'string') {
      for (const { pattern, city } of CITY_PATTERNS) {
        if (pattern.test(val)) return city;
      }
    }
    // Check nested objects
    if (typeof val === 'object' && val !== null) {
      const str = JSON.stringify(val);
      for (const { pattern, city } of CITY_PATTERNS) {
        if (pattern.test(str)) return city;
      }
    }
  }
  return null;
}

// ── Market data extraction ──
// The AODP operation codes for auction house
const AUCTION_OPS = {
  AuctionGetOffers: 75,
  AuctionGetRequests: 76,
  AuctionGetItemAverageStats: 89,
  AuctionGetItemAverageValue: 90,
};

const SENTINELS = new Set([999999, 1000000, 9999999, 99999999, 2147483647, 0]);
const MAX_PRICE = 50000000;

function isSentinel(v) {
  if (!v || v <= 0) return true;
  if (SENTINELS.has(v)) return true;
  if (v > MAX_PRICE) return true;
  return false;
}

function extractMarketData(operationCode, params) {
  const items = [];

  // Look for arrays in the parameters — these contain the auction listings
  for (const key of Object.keys(params)) {
    const val = params[key];
    if (!Array.isArray(val)) continue;

    for (const entry of val) {
      if (!entry || typeof entry !== 'object') continue;

      // Try to extract item data from each entry
      // Albion auction entries typically contain:
      // - itemTypeId (string like "T4_BAG")
      // - quality (int)
      // - unitPrice (int - price per unit)
      // - amount (int - quantity)
      // - auctionType (int - 1=sell, 2=buy)

      const itemTypeId = entry.itemTypeId || entry['0'] || entry.itemId;
      const unitPrice = entry.unitPrice || entry['3'] || entry.price;
      const amount = entry.amount || entry['4'] || entry.quantity;
      const quality = entry.quality || entry['2'] || 1;
      const auctionType = entry.auctionType || entry['5'] || entry.type;

      if (itemTypeId && typeof itemTypeId === 'string' && unitPrice) {
        if (!isSentinel(unitPrice)) {
          items.push({
            itemId: itemTypeId,
            quality: quality,
            unitPrice: Number(unitPrice),
            amount: Number(amount || 1),
            auctionType: Number(auctionType || 1),
          });
        }
      }
    }
  }

  // Also try parameter code patterns used by older protocol versions
  // Parameter '248' often contains the item list in auction responses
  if (params['248'] && Array.isArray(params['248'])) {
    for (const entry of params['248']) {
      if (!entry || typeof entry !== 'object') continue;
      const keys = Object.keys(entry);
      if (keys.length < 2) continue;

      // Try to find item ID and price in the object
      let itemId = null;
      let price = null;
      let quality = 1;

      for (const k of keys) {
        const v = entry[k];
        if (typeof v === 'string' && /^T\d/.test(v)) itemId = v;
        if (typeof v === 'number' && v > 0 && !isSentinel(v)) {
          if (!price) price = v;
        }
      }

      if (itemId && price) {
        items.push({
          itemId,
          quality,
          unitPrice: price,
          amount: 1,
          auctionType: 1,
        });
      }
    }
  }

  return items;
}

// ── Batch sender ──
class BatchSender {
  constructor(config) {
    this.server = config.server;
    this.apiKey = config.apiKey;
    this.buffer = [];
    this.batchInterval = config.batchInterval || 5000;
    this.maxBatchSize = config.maxBatchSize || 100;
    this.stats = { received: 0, sent: 0, errors: 0, items: 0 };
    this.currentCity = 'Caerleon';

    setInterval(() => this.flush(), this.batchInterval);
  }

  addItems(items, city) {
    const c = city || this.currentCity;
    for (const item of items) {
      this.buffer.push({
        itemId: item.itemId,
        city: c,
        quality: item.quality || 1,
        sellPriceMin: item.auctionType === 1 ? item.unitPrice : null,
        sellPriceMax: item.auctionType === 1 ? item.unitPrice : null,
        buyPriceMin: item.auctionType === 2 ? item.unitPrice : null,
        buyPriceMax: item.auctionType === 2 ? item.unitPrice : null,
        timestamp: new Date().toISOString(),
      });
      this.stats.received++;
    }

    if (this.buffer.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.maxBatchSize);

    try {
      const res = await fetch(`${this.server}/api/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(batch),
        timeout: 10000,
      });

      if (!res.ok) {
        const text = await res.text();
        logError(`Servidor ${res.status}: ${text}`);
        this.stats.errors++;
        // Put items back for retry
        this.buffer.unshift(...batch);
        return;
      }

      const data = await res.json();
      this.stats.sent++;
      this.stats.items += batch.length;
      log(`${batch.length} registros enviados (total: ${this.stats.items})`);
    } catch (err) {
      logError(`Falha ao enviar: ${err.message}`);
      this.stats.errors++;
      this.buffer.unshift(...batch);
    }
  }

  getStats() {
    return this.stats;
  }
}

// ── Main ──
function main() {
  const config = loadConfig();
  const sender = new BatchSender(config);

  log('---');
  log('Albion Market Insights - Cliente v2.0');
  log(`Servidor: ${config.server}`);
  log(`Nome: ${config.name || 'Sem nome'}`);
  log('---');
  log('Iniciando captura de pacotes...');
  log('Abra o Albion Online e visite o mercado para enviar dados.');
  log('Pressione Ctrl+C para sair.');
  log('');

  // Initialize packet capture
  let aoNet;
  try {
    aoNet = new AONetwork();
  } catch (err) {
    logError(`Falha ao iniciar captura: ${err.message}`);
    log('');
    log('Possíveis causas:');
    log('  1. Npcap não instalado — baixe de: https://npcap.com/#download');
    log('  2. Não está rodando como administrador');
    log('  3. Nenhuma interface de rede ativa');
    log('');
    log('Instale o Npcap (opção WinPcap compat) e reinicie este programa como admin.');
    process.exit(1);
  }

  // Listen for ALL decoded messages to detect city changes
  aoNet.events.use((result) => {
    const ctx = result.context;
    if (!ctx || !ctx.parameters) return;

    const city = detectCity(ctx.parameters);
    if (city && city !== sender.currentCity) {
      sender.currentCity = city;
      log(`Cidade detectada: ${city}`);
    }
  });

  // Listen for OperationResponses (auction data)
  aoNet.events.on(aoNet.AODecoder.messageType.OperationResponse, (context) => {
    if (!context || !context.parameters) return;

    const opCode = context.parameters['253'];
    if (opCode === undefined) return;

    // Check if it's an auction-related operation
    const isAuction = Object.values(AUCTION_OPS).includes(opCode);
    if (!isAuction) return;

    const items = extractMarketData(opCode, context.parameters);
    if (items.length > 0) {
      sender.addItems(items);
      log(`Mercado: ${items.length} itens capturados (op: ${opCode})`);
    }
  });

  // Also listen for Events (some market data comes as events)
  aoNet.events.on(aoNet.AODecoder.messageType.Event, (context) => {
    if (!context || !context.parameters) return;

    const eventCode = context.parameters['252'];
    if (eventCode === undefined) return;

    // MarketPlaceNotification event (181)
    if (eventCode === 181) {
      const items = extractMarketData(eventCode, context.parameters);
      if (items.length > 0) {
        sender.addItems(items);
        log(`Evento mercado: ${items.length} itens capturados`);
      }
    }
  });

  // Stats display every 30s
  setInterval(() => {
    const s = sender.getStats();
    if (s.received > 0) {
      log(`Stats: ${s.received} capturados, ${s.items} enviados, ${s.errors} erros`);
    }
  }, 30000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    log('Encerrando...');
    sender.flush().then(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    log('Encerrando...');
    sender.flush().then(() => process.exit(0));
  });
}

main();
