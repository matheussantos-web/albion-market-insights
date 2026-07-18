#!/usr/bin/env node

const { Cap, decoders } = require('cap');
const { PROTOCOL } = decoders;
const network = require('network');
const fetch = require('node-fetch');

const SERVER = 'http://191.252.219.229:3000';

function log(msg) { console.log(`[ami-client] ${msg}`); }
function logError(msg) { console.error(`[ami-client] ERRO: ${msg}`); }

const SENTINELS = new Set([999999, 1000000, 9999999, 99999999, 2147483647, 0]);
const MAX_PRICE = 50000000;
const ITEM_ID_REGEX = /T[1-8]_[A-Z0-9_@]+/g;

function isSentinel(v) {
  if (!v || v <= 0) return true;
  if (SENTINELS.has(v)) return true;
  if (v > MAX_PRICE) return true;
  return false;
}

function scanBuffer(buf, offset, length) {
  const results = [];
  const sub = buf.slice(offset, offset + length);
  const str = sub.toString('ascii');

  let match;
  ITEM_ID_REGEX.lastIndex = 0;
  while ((match = ITEM_ID_REGEX.exec(str)) !== null) {
    const itemId = match[0].replace(/@\d+$/, '');
    const pos = match.index;

    for (let i = pos + match[0].length; i < Math.min(pos + match[0].length + 60, length); i++) {
      if (i + 4 > length) break;
      const val = sub.readUInt32BE(i);
      if (!isSentinel(val) && val >= 100 && val <= MAX_PRICE) {
        results.push({ itemId, price: val });
        break;
      }
    }
  }

  return results;
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

  addItem(itemId, price, city) {
    this.buffer.push({
      itemId,
      city: city || this.currentCity,
      quality: 1,
      sellPriceMin: price,
      sellPriceMax: price,
      buyPriceMin: null,
      buyPriceMax: null,
      timestamp: new Date().toISOString(),
    });
    this.stats.received++;

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
  log('Abra o Albion Online e visite o mercado.');
  log('Pressione Ctrl+C para sair.');
  log('');

  const cap = new Cap();
  const buffer = Buffer.alloc(65535);

  network.get_active_interface((err, obj) => {
    if (err) {
      logError('Não foi possível encontrar rede ativa.');
      log('Verifique sua conexão com a internet.');
      process.exit(1);
    }

    const device = Cap.findDevice(obj.ip_address);
    const filter = 'udp and (dst port 5056 or src port 5056)';
    const bufSize = 10 * 1024 * 1024;

    const linkType = cap.open(device, filter, bufSize, buffer);
    cap.setMinBytes && cap.setMinBytes(0);

    log(`Rede: ${obj.ip_address}`);
    log(`Filtrando pacotes UDP na porta 5056...`);
    log('');

    cap.on('packet', (nBytes) => {
      if (linkType !== 'ETHERNET') return;

      let ret = decoders.Ethernet(buffer);
      if (ret.info.type !== PROTOCOL.ETHERNET.IPV4) return;

      ret = decoders.IPV4(buffer, ret.offset);
      if (ret.info.protocol !== PROTOCOL.IP.UDP) return;

      ret = decoders.UDP(buffer, ret.offset);
      if (ret.info.srcport != 5056 && ret.info.dstport != 5056) return;

      const udpPayloadOffset = ret.offset;
      const udpPayloadLength = ret.info.length;

      // Scan for item IDs and prices
      const items = scanBuffer(buffer, udpPayloadOffset, udpPayloadLength);
      for (const { itemId, price } of items) {
        sender.addItem(itemId, price);
      }
    });

    setInterval(() => {
      const s = sender.getStats();
      if (s.received > 0) {
        log(`Stats: ${s.received} capturados, ${s.items} enviados, ${s.errors} erros`);
      }
    }, 30000);
  });

  process.on('SIGINT', () => { sender.flush().then(() => process.exit(0)); });
  process.on('SIGTERM', () => { sender.flush().then(() => process.exit(0)); });
}

main();
