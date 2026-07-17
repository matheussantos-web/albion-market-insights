const { getDb } = require('../db/init');

/**
 * Exige header: x-api-key: <chave do contribuidor>
 * Anexa req.contributor com { id, name } se válida.
 */
function requireContributorKey(req, res, next) {
  const key = req.header('x-api-key');
  if (!key) {
    return res.status(401).json({ error: 'x-api-key ausente' });
  }

  const db = getDb();
  const contributor = db
    .prepare('SELECT id, name, active FROM contributors WHERE api_key = ?')
    .get(key);

  if (!contributor || !contributor.active) {
    return res.status(403).json({ error: 'API key inválida ou inativa' });
  }

  db.prepare("UPDATE contributors SET last_seen_at = datetime('now') WHERE id = ?")
    .run(contributor.id);

  req.contributor = contributor;
  next();
}

/**
 * Endpoints administrativos (criar/revogar chaves) protegidos por segredo simples.
 */
function requireAdminSecret(req, res, next) {
  const secret = req.header('x-admin-secret');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'não autorizado' });
  }
  next();
}

module.exports = { requireContributorKey, requireAdminSecret };
