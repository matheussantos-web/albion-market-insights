const { spawn, execSync } = require('child_process');
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const exeDir = path.dirname(process.execPath);
const configPath = path.join(exeDir, 'config.json');
const binDir = path.join(exeDir, 'bin');

function log(msg) { console.log(`[albion-client] ${msg}`); }

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    log('ERRO: config.json não encontrado!');
    log(`Crie o arquivo em: ${configPath}`);
    log('');
    log('Conteúdo mínimo:');
    log(JSON.stringify({
      server: 'http://SEU_SERVIDOR:3000',
      apiKey: 'SUA_API_KEY',
      region: 'europe',
      proxyPort: 3456
    }, null, 2));
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { fs.unlinkSync(dest); reject(err); });
  });
}

async function ensureClient() {
  const clientName = process.platform === 'win32' ? 'albiondata-client.exe' : 'albiondata-client';

  try {
    if (process.platform === 'win32') {
      execSync(`where ${clientName}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${clientName}`, { stdio: 'ignore' });
    }
    log(`${clientName} encontrado no PATH`);
    return clientName;
  } catch {}

  fs.mkdirSync(binDir, { recursive: true });
  const localPath = path.join(binDir, clientName);
  if (fs.existsSync(localPath)) {
    log(`${clientName} encontrado em bin/`);
    return localPath;
  }

  log(`${clientName} não encontrado. Tentando baixar automaticamente...`);
  const repo = 'broderickhyde/albiondata-client';
  let downloadUrl;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
    const release = await res.json();
    if (!release.assets || !Array.isArray(release.assets)) {
      throw new Error('sem assets no release');
    }
    const asset = release.assets.find((a) =>
      a.name && (a.name.includes('win') || a.name.endsWith('.exe'))
    );
    if (!asset) throw new Error('asset windows não encontrado');
    downloadUrl = asset.browser_download_url;
  } catch (err) {
    log(`auto-download falhou: ${err.message}`);
    log('');
    log('Baixe manualmente:');
    log(`  https://github.com/${repo}/releases`);
    log(`Coloque ${clientName} na pasta: ${binDir}`);
    log('Ou adicione o albiondata-client no PATH do sistema.');
    log('');
    log('Continuando sem o client - o proxy vai rodar normalmente.');
    log('Quando o albiondata-client estiver disponível, reinicie este programa.');
    return null;
  }

  log(`Baixando de: ${downloadUrl}`);
  try {
    await download(downloadUrl, localPath);
    log('Download concluído!');
    return localPath;
  } catch (err) {
    log(`Falha no download: ${err.message}`);
    log(`Baixe manualmente: ${downloadUrl}`);
    log(`Coloque na pasta: ${binDir}`);
    return null;
  }
}

function startProxy(config) {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json({ limit: '5mb' }));

    let stats = { received: 0, sent: 0, errors: 0 };

    app.post('/ingest', async (req, res) => {
      stats.received++;
      const payload = Array.isArray(req.body) ? req.body : [req.body];
      try {
        const response = await fetch(`${config.server}/api/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const text = await response.text();
          log(`servidor respondeu ${response.status}: ${text}`);
          stats.errors++;
          return res.status(502).json({ error: 'servidor rejeitou', detail: text });
        }
        const data = await response.json();
        stats.sent++;
        log(`${data.inserted || payload.length} registros enviados`);
        res.json({ ok: true, forwarded: data.inserted || payload.length });
      } catch (err) {
        stats.errors++;
        log(`erro ao enviar: ${err.message}`);
        res.status(502).json({ error: 'falha ao conectar', detail: err.message });
      }
    });

    app.get('/stats', (req, res) => res.json(stats));

    const port = config.proxyPort || 3456;
    const server = app.listen(port, () => {
      log(`proxy rodando em http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function main() {
  const config = loadConfig();

  log('---');
  log(`Servidor: ${config.server}`);
  log(`Região: ${config.region || 'europe'}`);
  log('---');

  const clientPath = await ensureClient();
  const port = config.proxyPort || 3456;

  await startProxy(config);

  if (!clientPath) {
    log('Proxy rodando. Coloque albiondata-client.exe e reinicie.');
    log(`Ou baixe de: https://github.com/broderickhyde/albiondata-client/releases`);
    return;
  }

  log(`iniciando albiondata-client...`);
  const client = spawn(clientPath, [
    '-i', `http://localhost:${port}/ingest`,
  ], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  client.on('error', (err) => {
    log(`erro no client: ${err.message}`);
  });

  client.on('exit', (code) => {
    log(`client encerrou (código ${code})`);
  });

  log('Aguardando dados do jogo... Pressione Ctrl+C para sair.');

  process.on('SIGINT', () => {
    log('encerrando...');
    client.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  log(`erro fatal: ${err.message}`);
  process.exit(1);
});
