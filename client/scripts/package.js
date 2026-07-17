const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const output = fs.createWriteStream(path.join(distDir, 'albion-insights-client.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Pacote criado: ${archive.pointer()} bytes`);
});

archive.pipe(output);

// Add the exe
archive.file(path.join(distDir, 'albion-client.exe'), { name: 'albion-client.exe' });

// Add config template
archive.file(path.join(__dirname, '..', 'config.json'), { name: 'config.json' });

// Add instructions
const instructions = `Albion Market Insights - Cliente
================================

1. Instale o Npcap: https://npcap.com/#download
   (marque "WinPcap API-compatible Mode")

2. Edite config.json com sua API key

3. Clique com botão direito em albion-client.exe
   → "Executar como administrador"

4. Abra o Albion Online e visite o mercado

5. Os dados são enviados automaticamente!

Obrigado por contribuir!
`;

archive.append(instructions, { name: 'LEIA-ME.txt' });

archive.finalize();
