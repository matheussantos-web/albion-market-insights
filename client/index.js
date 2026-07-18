#!/usr/bin/env node

const { Cap, decoders } = require('cap');
const { PROTOCOL } = decoders;
const network = require('network');
const fetch = require('node-fetch');
const { parsePhotonPacket, setDebug, getCurrentLocation, getDiag, PHOTON_VERSION } = require('./photon');

const SERVER = 'http://191.252.219.229:3000';
const DEBUG = process.env.DEBUG === '1';
const CLIENT_VERSION = '4.0.1-diag';

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

  addItem(itemId, price, quality, city) {
    this.buffer.push({
      itemId,
      city: city || 'Caerleon',
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

  log('========================================');
  log(`VERSION: ${CLIENT_VERSION} | PHOTON: ${PHOTON_VERSION}`);
  log('========================================');
  log('Albion Market Insights - Cliente v4.0.1 (AODP Architecture)');
  log('========================================');
  log('Iniciando captura de pacotes...');
  log('Abra o Albion Online e visite o mercado.');
  log('A cidade sera detectada automaticamente.');
  log('Pressione Ctrl+C para sair.');
  log('');
  if (DEBUG) log('MODO DEBUG ATIVADO');
  log('DIAGNOSTICOS ATIVOS: [hex] [diag] [raw]');

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
    const portStats = { src5056: 0, dst5056: 0, both: 0 };
    const ipStats = {};

    cap.on('packet', (nBytes) => {
      pktCount++;
      if (linkType !== 'ETHERNET') return;

      let ret = decoders.Ethernet(buffer);
      if (ret.info.type !== PROTOCOL.ETHERNET.IPV4) return;

      const srcIp = ret.info.srcaddr;
      const dstIp = ret.info.dstaddr;

      ret = decoders.IPV4(buffer, ret.offset);
      if (ret.info.protocol !== PROTOCOL.IP.UDP) return;

      ret = decoders.UDP(buffer, ret.offset);
      if (ret.info.srcport != 5056 && ret.info.dstport != 5056) return;

      const srcPort = ret.info.srcport;
      const dstPort = ret.info.dstport;
      const payload = buffer.slice(ret.offset, ret.offset + ret.info.length);

      // Track port direction
      if (srcPort == 5056 && dstPort == 5056) {
        portStats.both++;
      } else if (srcPort == 5056) {
        portStats.src5056++;
      } else if (dstPort == 5056) {
        portStats.dst5056++;
      }

      // Track IPs
      const ipKey = `${srcIp}->${dstIp}`;
      ipStats[ipKey] = (ipStats[ipKey] || 0) + 1;

      // First 10 packets: full raw hex + direction
      if (pktCount <= 10) {
        const dir = srcPort == 5056 ? 'SRV->CLI' : (dstPort == 5056 ? 'CLI->SRV' : '???');
        const rawHex = Array.from(payload.slice(0, 60)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`[raw] pkt#${pktCount} ${dir} ${srcIp}:${srcPort} -> ${dstIp}:${dstPort} len=${payload.length} nBytes=${nBytes}`);
        console.log(`[raw]   hex: ${rawHex}`);
      }

      try {
        const items = parsePhotonPacket(payload);
        parsedCount++;
        if (items.length > 0) {
          foundCount += items.length;
          for (const { itemId, price, quality, locationName, amount, auctionType } of items) {
            sender.addItem(itemId, price, quality, locationName);
            const tag = auctionType === 'request' ? '[COMPRAR]' : '[VENDER]';
            log(`${tag} ${itemId} = ${price} silver x${amount} (${locationName})`);
          }
        }
      } catch (e) {
        if (pktCount <= 10) console.log(`[raw]   DECODE ERROR: ${e.message}`);
      }
    });

    setInterval(() => {
      const s = sender.getStats();
      const loc = getCurrentLocation();
      const d = getDiag();
      if (pktCount > 0) {
        log('========================================');
        log(`VERSION: ${CLIENT_VERSION} | PHOTON: ${PHOTON_VERSION}`);
        log('========================================');
        log(`--- Stats ---`);
        log(`Packets: ${pktCount} total, ${parsedCount} parsed`);
        log(`Port dir: src5056=${portStats.src5056} dst5056=${portStats.dst5056} both=${portStats.both}`);
        log(`IPs: ${JSON.stringify(ipStats)}`);
        log(`Cmd types: ${JSON.stringify(d.cmdTypes || {})} (total=${d.cmdTotal || 0} skipped=${d.cmdSkipped || 0})`);
        log(`Msg types: ${JSON.stringify(d.msgTypes || {})}`);
        log(`OpCodes seen: ${JSON.stringify(d.opCodes || {})}`);
        log(`Event codes: ${JSON.stringify(d.evtCodes || {})}`);
        log(`Errors: ${(d.errs || []).slice(0, 5).join('; ') || 'none'}`);
        log(`Msgs decoded: ${d.seen || 0}`);
        log(`Itens: ${foundCount} found, ${s.items} sent`);
        log(`City: ${loc.name} (${loc.id})`);
        log(`---`);
      }
    }, 15000);
  });

  process.on('SIGINT', () => { sender.flush().then(() => process.exit(0)); });
  process.on('SIGTERM', () => { sender.flush().then(() => process.exit(0)); });
}

main();
