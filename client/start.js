const { spawn } = require('child_process');
const path = require('path');
const config = require('./config.json');

const PROXY_PORT = config.proxyPort || 3456;

function log(msg) {
  console.log(`[start] ${msg}`);
}

function startProxy() {
  log('iniciando proxy...');
  const proxy = spawn(process.execPath, [path.join(__dirname, 'proxy.js')], {
    stdio: 'inherit',
    cwd: __dirname,
  });
  proxy.on('error', (err) => log(`erro no proxy: ${err.message}`));
  proxy.on('exit', (code) => log(`proxy encerrou (código ${code})`));
  return proxy;
}

function startClient() {
  const region = config.region || 'europe';
  const regionMap = {
    europe: 'https://europe.albion-online-data.com',
    west: 'https://west.albion-online-data.com',
    east: 'https://east.albion-online-data.com',
  };

  log(`iniciando albiondata-client (região: ${region})...`);
  log(`proxy local: http://localhost:${PROXY_PORT}/ingest`);

  const client = spawn('albiondata-client', [
    '-i', `http://localhost:${PROXY_PORT}/ingest`,
  ], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  client.on('error', (err) => {
    if (err.code === 'ENOENT') {
      log('ERRO: albiondata-client não encontrado!');
      log('Instale: https://github.com/broderickhyde/albiondata-client/releases');
      log('Ou baixe o .exe e coloque na pasta ou no PATH do sistema.');
    } else {
      log(`erro no client: ${err.message}`);
    }
  });

  client.on('exit', (code) => log(`client encerrou (código ${code})`));
  return client;
}

function printStatus() {
  log('---');
  log(`Servidor: ${config.server}`);
  log(`Região: ${config.region}`);
  log(`Proxy: localhost:${PROXY_PORT}`);
  log('Aguardando dados do jogo...');
  log('---');
}

printStatus();
const proxy = startProxy();

setTimeout(() => {
  const client = startClient();

  process.on('SIGINT', () => {
    log('encerrando...');
    client.kill();
    proxy.kill();
    process.exit(0);
  });
}, 1000);
