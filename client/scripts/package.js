const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, '..');
const distDir = path.join(clientDir, 'dist');
const output = fs.createWriteStream(path.join(distDir, 'albion-insights-client.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Pacote criado: ${archive.pointer()} bytes`);
  console.log(`Arquivos:`);
  archive.pointer(); // just for the close event
});

archive.pipe(output);

// Client exe
archive.file(path.join(distDir, 'albion-client.exe'), { name: 'albion-client.exe' });

// Npcap installer
archive.file(path.join(distDir, 'npcap-1.88.exe'), { name: 'npcap-1.88.exe' });

// Config template
archive.file(path.join(clientDir, 'config.json'), { name: 'config.json' });

// Batch scripts
archive.file(path.join(clientDir, 'INSTALAR.bat'), { name: 'INSTALAR.bat' });
archive.file(path.join(clientDir, 'INICIAR.bat'), { name: 'INICIAR.bat' });
archive.file(path.join(clientDir, 'CONFIGURAR.bat'), { name: 'CONFIGURAR.bat' });

// Instructions
archive.file(path.join(clientDir, 'LEIA-ME.txt'), { name: 'LEIA-ME.txt' });

archive.finalize();
