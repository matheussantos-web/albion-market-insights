#!/usr/bin/env node

const { Cap, decoders } = require('cap');
const { PROTOCOL } = decoders;
const network = require('network');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { parsePhotonPacket, setDebug, getCurrentLocation, getDiag, PHOTON_VERSION } = require('./photon');

const SERVER = 'http://191.252.219.229:3000';
const CLIENT_VERSION = '4.0.2-logfile';
const LOG_FILE = path.join(__dirname, 'debug.log');

function logToConsole(msg) { process.stdout.write(msg + '\n'); }
function logError(msg) { process.stderr.write(`ERRO: ${msg}\n`); }
function logFile(msg) {
  try { fs.appendFileSync(LOG_FILE, msg + '\n'); } catch(e) {}
}

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
    if (this.buffer.length >= this.maxBatchSize) this.flush();
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

  getStats() { return this.stats; }
}

// ── Main ──
function main() {
  // Clear old log
  try { fs.writeFileSync(LOG_FILE, ''); } catch(e) {}

  const sender = new BatchSender();

  logToConsole(`AMI Client ${CLIENT_VERSION} | Photon ${PHOTON_VERSION}`);
  logToConsole('Capturando pacotes UDP 5056...');
  logToConsole('Abra o Albion e va ao mercado. Ctrl+C para sair.');
  logToConsole('');

  const cap = new Cap();
  const buffer = Buffer.alloc(65535);

  network.get_active_interface((err, obj) => {
    if (err) { logToConsole('Rede nao encontrada.'); process.exit(1); }

    const device = Cap.findDevice(obj.ip_address);
    const filter = 'udp and (dst port 5056 or src port 5056)';
    const bufSize = 10 * 1024 * 1024;
    const linkType = cap.open(device, filter, bufSize, buffer);
    cap.setMinBytes && cap.setMinBytes(0);

    logToConsole(`Rede: ${obj.ip_address}`);
    logToConsole(`Log completo: ${LOG_FILE}`);
    logToConsole('');

    setDebug(false);

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

      if (srcPort == 5056 && dstPort == 5056) portStats.both++;
      else if (srcPort == 5056) portStats.src5056++;
      else if (dstPort == 5056) portStats.dst5056++;

      const ipKey = `${srcIp}:${srcPort}->${dstIp}:${dstPort}`;
      ipStats[ipKey] = (ipStats[ipKey] || 0) + 1;

      // Log ALL packet details to file
      const dir = srcPort == 5056 ? 'SRV->CLI' : 'CLI->SRV';
      logFile(`=== PKT#${pktCount} ${dir} ${srcIp}:${srcPort}->${dstIp}:${dstPort} len=${payload.length} ===`);
      logFile(`HEX: ${Array.from(payload.slice(0, 80)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

      try {
        const items = parsePhotonPacket(payload);
        parsedCount++;
        if (items.length > 0) {
          foundCount += items.length;
          for (const { itemId, price, quality, locationName, amount, auctionType } of items) {
            sender.addItem(itemId, price, quality, locationName);
            const tag = auctionType === 'request' ? '[COMPRAR]' : '[VENDER]';
            logToConsole(`${tag} ${itemId} = ${price} silver x${amount} (${locationName})`);
            logFile(`${tag} ${itemId} = ${price} silver x${amount} (${locationName})`);
          }
        }
      } catch (e) {
        logFile(`DECODE ERROR: ${e.message}`);
      }
    });

    setInterval(() => {
      const s = sender.getStats();
      const loc = getCurrentLocation();
      const d = getDiag();
      if (pktCount > 0) {
        logToConsole('--- Stats ---');
        logToConsole(`Pacotes: ${pktCount} (parsed: ${parsedCount})`);
        logToConsole(`Dir: srv->cli=${portStats.src5056} cli->srv=${portStats.dst5056} both=${portStats.both}`);
        logToConsole(`Cmds: ${JSON.stringify(d.cmdTypes||{})} (total=${d.cmdTotal||0} skip=${d.cmdSkipped||0})`);
        logToConsole(`Msgs: ${JSON.stringify(d.msgTypes||{})} decoded=${d.seen||0}`);
        logToConsole(`OpCodes: ${JSON.stringify(d.opCodes||{})}`);
        logToConsole(`Events: ${JSON.stringify(d.evtCodes||{})}`);
        logToConsole(`Erros: ${(d.errs||[]).slice(0,3).join('; ')||'nenhum'}`);
        logToConsole(`Itens: ${foundCount} found, ${s.items} sent`);
        logToConsole(`Cidade: ${loc.name} (${loc.id})`);
        logToConsole(`Log: ${LOG_FILE}`);
        logToConsole('---');
      }
    }, 15000);
  });

  process.on('SIGINT', () => {
    const d = getDiag();
    logToConsole(`Final: ${JSON.stringify(d)}`);
    logFile(`Final: ${JSON.stringify(d)}`);
    sender.flush().then(() => process.exit(0));
  });
  process.on('SIGTERM', () => { sender.flush().then(() => process.exit(0)); });
}

main();
