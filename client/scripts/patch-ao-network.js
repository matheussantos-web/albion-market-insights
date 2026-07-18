const fs = require('fs');
const path = require('path');

const deserializerPath = path.join(__dirname, '..', 'node_modules', 'ao-network', 'libs', 'PhotonParser', 'Protocol16', 'Deserializer.js');

if (!fs.existsSync(deserializerPath)) {
  console.log('[patch] ao-network not installed yet, skipping');
  process.exit(0);
}

let content = fs.readFileSync(deserializerPath, 'utf8');

const oldCode = "throw new Error(`Type code: ${typeCode} not implemented.`);";
const newCode = "return null;";

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(deserializerPath, content, 'utf8');
  console.log('[patch] ao-network deserializer patched — unknown type codes return null instead of crashing');
} else {
  console.log('[patch] ao-network already patched or pattern not found');
}
