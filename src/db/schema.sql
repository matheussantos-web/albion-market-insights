-- Itens do jogo (populado via scripts/importItems.js)
CREATE TABLE IF NOT EXISTS items (
  unique_name   TEXT PRIMARY KEY,   -- ex: T4_BAG, T5_2H_HOLYSTAFF
  name_ptbr     TEXT,
  name_en       TEXT,
  tier          INTEGER,
  enchantment   INTEGER DEFAULT 0,
  category      TEXT,
  tradeable     INTEGER DEFAULT 1,
  item_base     TEXT,
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- Cidades/mercados
CREATE TABLE IF NOT EXISTS locations (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT UNIQUE NOT NULL
);

INSERT OR IGNORE INTO locations (name) VALUES
  ('Caerleon'), ('Bridgewatch'), ('Lymhurst'),
  ('Martlock'), ('Fort Sterling'), ('Thetford'), ('Black Market');

-- Preços de mercado (série histórica, um registro por observação)
CREATE TABLE IF NOT EXISTS market_prices (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_unique_name TEXT NOT NULL,
  location_id   INTEGER NOT NULL,
  quality       INTEGER DEFAULT 1,
  sell_price_min INTEGER,
  sell_price_max INTEGER,
  buy_price_min  INTEGER,
  buy_price_max  INTEGER,
  observed_at    TEXT NOT NULL,   -- timestamp reportado pelo albiondata-client
  ingested_at    TEXT DEFAULT (datetime('now')),
  contributor_id TEXT,            -- NULL quando source = 'public_adp'
  source         TEXT NOT NULL DEFAULT 'private', -- 'private' | 'public_adp'
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE INDEX IF NOT EXISTS idx_prices_item ON market_prices(item_unique_name);
CREATE INDEX IF NOT EXISTS idx_prices_location ON market_prices(location_id);
CREATE INDEX IF NOT EXISTS idx_prices_observed ON market_prices(observed_at);
CREATE INDEX IF NOT EXISTS idx_prices_source ON market_prices(source);

-- Itens que o sync público (AODP) deve cobrir como baseline.
-- Só entra aqui o que você quiser ter cobertura pública de fallback;
-- não sincroniza o catálogo inteiro pra não gastar rate limit à toa.
CREATE TABLE IF NOT EXISTS public_sync_watchlist (
  item_unique_name TEXT PRIMARY KEY,
  added_at TEXT DEFAULT (datetime('now'))
);

-- Contribuidores autorizados a mandar dados (ingestão distribuída)
CREATE TABLE IF NOT EXISTS contributors (
  id          TEXT PRIMARY KEY,   -- uuid
  name        TEXT NOT NULL,
  api_key     TEXT UNIQUE NOT NULL,
  active      INTEGER DEFAULT 1,
  user_id     INTEGER,            -- vincula ao usuarios
  created_at  TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT
);

-- Usuários do sistema (login/registro)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  role          TEXT DEFAULT 'user', -- 'user' | 'admin'
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Sessões ativas
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS recipes (
  item_unique_name TEXT PRIMARY KEY,
  silver_cost      INTEGER DEFAULT 0,
  craft_time       REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS recipe_resources (
  item_unique_name     TEXT NOT NULL,
  resource_unique_name TEXT NOT NULL,
  count                INTEGER NOT NULL,
  PRIMARY KEY (item_unique_name, resource_unique_name)
);
CREATE INDEX IF NOT EXISTS idx_recipe_res_item ON recipe_resources(item_unique_name);
CREATE INDEX IF NOT EXISTS idx_recipe_res_res ON recipe_resources(resource_unique_name);
