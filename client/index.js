#!/usr/bin/env node

const AONetwork = require('ao-network');
const fetch = require('node-fetch');

const SERVER = 'http://191.252.219.229:3000';

function log(msg) { console.log(`[ami-client] ${msg}`); }
function logError(msg) { console.error(`[ami-client] ERRO: ${msg}`); }

// ── City detection ──
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
  for (const key of Object.keys(params)) {
    const val = params[key];
    if (typeof val === 'string') {
      for (const { pattern, city } of CITY_PATTERNS) {
        if (pattern.test(val)) return city;
      }
    }
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

  for (const key of Object.keys(params)) {
    const val = params[key];
    if (!Array.isArray(val)) continue;

    for (const entry of val) {
      if (!entry || typeof entry !== 'object') continue;

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

  if (params['248'] && Array.isArray(params['248'])) {
    for (const entry of params['248']) {
      if (!entry || typeof entry !== 'object') continue;
      const keys = Object.keys(entry);
      if (keys.length < 2) continue;

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
  constructor() {
    this.buffer = [];
    this.batchInterval = 5000;
    this.maxBatchSize = 100;
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
      const res = await fetch(`${SERVER}/api/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        timeout: 10000,
      });

      if (!res.ok) {
        const text = await res.text();
        logError(`Servidor ${res.status}: ${text}`);
        this.stats.errors++;
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
  const sender = new BatchSender();

  log('---');
  log('Albion Market Insights - Cliente v2.0');
  log('---');
  log('Iniciando captura de pacotes...');
  log('Abra o Albion Online e visite o mercado para enviar dados.');
  log('Pressione Ctrl+C para sair.');
  log('');

  let aoNet;
  try {
    aoNet = new AONetwork();
  } catch (err) {
    logError(`Falha ao iniciar captura: ${err.message}`);
    log('');
    log('Possíveis causas:');
    log('  1. Npcap não instalado — execute npcap-1.88.exe');
    log('  2. Não está rodando como administrador');
    log('  3. Nenhuma interface de rede ativa');
    log('');
    log('Instale o Npcap (opção WinPcap compat) e reinicie como admin.');
    process.exit(1);
  }

  aoNet.events.use((result) => {
    const ctx = result.context;
    if (!ctx || !ctx.parameters) return;

    const city = detectCity(ctx.parameters);
    if (city && city !== sender.currentCity) {
      sender.currentCity = city;
      log(`Cidade detectada: ${city}`);
    }
  });

  aoNet.events.on(aoNet.AODecoder.messageType.OperationResponse, (context) => {
    if (!context || !context.parameters) return;

    const opCode = context.parameters['253'];
    if (opCode === undefined) return;

    const isAuction = Object.values(AUCTION_OPS).includes(opCode);
    if (!isAuction) return;

    const items = extractMarketData(opCode, context.parameters);
    if (items.length > 0) {
      sender.addItems(items);
      log(`Mercado: ${items.length} itens capturados (op: ${opCode})`);
    }
  });

  aoNet.events.on(aoNet.AODecoder.messageType.Event, (context) => {
    if (!context || !context.parameters) return;

    const eventCode = context.parameters['252'];
    if (eventCode === undefined) return;

    if (eventCode === 181) {
      const items = extractMarketData(eventCode, context.parameters);
      if (items.length > 0) {
        sender.addItems(items);
        log(`Evento mercado: ${items.length} itens capturados`);
      }
    }
  });

  setInterval(() => {
    const s = sender.getStats();
    if (s.received > 0) {
      log(`Stats: ${s.received} capturados, ${s.items} enviados, ${s.errors} erros`);
    }
  }, 30000);

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
