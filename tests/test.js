const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, 'test.db');

process.env.DB_PATH = TEST_DB;
process.env.ADMIN_SECRET = 'test-secret';

describe('config', () => {
  it('loads defaults', () => {
    const config = require('../src/config');
    assert.strictEqual(typeof config.port, 'number');
    assert.strictEqual(config.adminSecret, 'test-secret');
    assert.ok(config.publicSyncRegion);
  });
});

describe('db init', () => {
  after(() => { if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB); });

  it('creates schema', () => {
    const { init } = require('../src/db/init');
    const db = init();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const names = tables.map((t) => t.name);
    assert.ok(names.includes('items'));
    assert.ok(names.includes('market_prices'));
    assert.ok(names.includes('locations'));
    assert.ok(names.includes('contributors'));
    assert.ok(names.includes('public_sync_watchlist'));
  });
});

describe('priceCache', () => {
  const cache = require('../src/services/priceCache');

  after(() => cache.clear());

  it('set and get', () => {
    cache.set('test:key', [{ city: 'Caerleon' }]);
    const result = cache.get('test:key');
    assert.deepStrictEqual(result, [{ city: 'Caerleon' }]);
  });

  it('returns null for missing key', () => {
    assert.strictEqual(cache.get('nonexistent'), null);
  });

  it('invalidate clears matching keys', () => {
    cache.set('ITEM1:latest', [1]);
    cache.set('ITEM1:history', [2]);
    cache.set('ITEM2:latest', [3]);
    cache.invalidate('ITEM1');
    assert.strictEqual(cache.get('ITEM1:latest'), null);
    assert.strictEqual(cache.get('ITEM1:history'), null);
    assert.deepStrictEqual(cache.get('ITEM2:latest'), [3]);
  });
});

describe('rateLimit', () => {
  const { rateLimit } = require('../src/middleware/rateLimit');

  it('allows requests under limit', () => {
    const middleware = rateLimit(3);
    let nextCalled = false;
    middleware({ ip: '1.2.3.4' }, { status: () => ({ json: () => {} }) }, () => { nextCalled = true; });
    assert.ok(nextCalled);
  });

  it('blocks requests over limit', () => {
    const middleware = rateLimit(2);
    middleware({ ip: '5.6.7.8' }, { status: () => ({ json: () => {} }) }, () => {});
    middleware({ ip: '5.6.7.8' }, { status: () => ({ json: () => {} }) }, () => {});
    let blocked = false;
    middleware({ ip: '5.6.7.8' }, { status: (code) => ({ json: (msg) => { if (code === 429) blocked = true; } }) }, () => {});
    assert.ok(blocked);
  });
});
