#!/usr/bin/env node

const { Cap, decoders } = require('cap');
const { PROTOCOL } = decoders;
const network = require('network');
const fetch = require('node-fetch');
const { parsePhotonPacket, setDebug } = require('./photon');

const SERVER = 'http://191.252.219.229:3000';
const DEBUG = process.env.DEBUG === '1';

function log(msg) { console.log(`[ami-client] ${msg}`); }
function logError(msg) { console.error(`[ami-client] ERRO: ${msg}`); }

// ── Batch sender ──
class BatchSender {
  constructor() {
    this.buffer = [];
    this.batchInterval = 5000;
    this.maxBatchSize = 100;
    this.stats = { received: 0, sent: 0, errors: 0, items: 0 };

    setInterval(() => this.flush(), this.batchInterval);
  }

  addItem(itemId, price, quality) {
    this.buffer.push({
      itemId,
      city: 'Caerleon',
      quality: quality || 1,
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
  if (DEBUG) log('MODO DEBUG ATIVADO');

  const cap = new Cap();
  const buffer = Buffer.alloc(65535);

  network.get_active_interface((err, obj) => {
    if (err) {
      logError('Não foi possível encontrar rede ativa.');
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
    setDebug(DEBUG);

    let pktCount = 0;
    let parsedCount = 0;
    let foundCount = 0;

    cap.on('packet', (nBytes) => {
      pktCount++;
      if (linkType !== 'ETHERNET') return;

      let ret = decoders.Ethernet(buffer);
      if (ret.info.type !== PROTOCOL.ETHERNET.IPV4) return;

      ret = decoders.IPV4(buffer, ret.offset);
      if (ret.info.protocol !== PROTOCOL.IP.UDP) return;

      ret = decoders.UDP(buffer, ret.offset);
      if (ret.info.srcport != 5056 && ret.info.dstport != 5056) return;

      const payload = buffer.slice(ret.offset, ret.offset + ret.info.length);

      try {
        const items = parsePhotonPacket(payload);
        parsedCount++;
        if (items.length > 0) {
          foundCount += items.length;
          for (const { itemId, price, quality } of items) {
            sender.addItem(itemId, price, quality);
            log(`Item: ${itemId} = ${price} silver`);
          }
        }
      } catch (e) {
        // Ignore unparseable packets
      }
    });

    setInterval(() => {
      const s = sender.getStats();
      if (pktCount > 0) {
        log(`Pacotes: ${pktCount} recebidos, ${parsedCount} parseados, ${foundCount} itens, ${s.items} enviados`);
      }
    }, 15000);
  });

  process.on('SIGINT', () => { sender.flush().then(() => process.exit(0)); });
  process.on('SIGTERM', () => { sender.flush().then(() => process.exit(0)); });
}

main();
