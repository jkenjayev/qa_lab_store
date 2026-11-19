import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PROMOS } from '../src/data/promos.js';
import { PRODUCTS } from '../src/data/products.js';
import { catalogEntities, createStorage, memoryStorage, resolveMode } from '../src/storage/bootstrap.js';
import { runSeed, runVerify } from '../src/storage/cli.js';
import { WriteQueue } from '../src/storage/WriteQueue.js';
import { VALID_CARD, VALID_DELIVERY, startServer } from './helpers.js';
import { FakeNotionGateway } from './fakeGateway.js';

const ENV = { NOTION_TOKEN: 'placeholder-token-for-tests' };
const instantQueue = () => new WriteQueue({ minIntervalMs: 0, sleep: async () => {} });
const movableClock = (iso = '2026-11-19T15:00:00') => {
  let t = new Date(iso).getTime();
  return { now: () => new Date(t), advance: (ms) => { t += ms; } };
};

async function seededGateway() {
  const gateway = new FakeNotionGateway();
  await runSeed({ env: ENV, gateway, queue: instantQueue(), log: () => {} });
  return gateway;
}

async function boot(gateway, clock = movableClock(), mode = 'on') {
  const storage = await createStorage({ env: ENV, clock, gateway, queue: instantQueue(), warn: () => {} });
  const server = await startServer({ mode, storage, clock });
  return { storage, server, clock };
}

describe('storage mode', () => {
  it('uses Notion when a token is set, memory otherwise, and warns', () => {
    const warnings = [];
    assert.equal(resolveMode({ NOTION_TOKEN: 'x' }), 'notion');
    assert.equal(resolveMode({}, (m) => warnings.push(m)), 'memory');
    assert.match(warnings[0], /memory mode/);
    assert.equal(resolveMode({ STORAGE: 'memory', NOTION_TOKEN: 'x' }), 'memory');
    assert.equal(resolveMode({ STORAGE: 'NOTION', NOTION_TOKEN: 'x' }), 'notion');
    assert.throws(() => resolveMode({ STORAGE: 'notion' }), /needs NOTION_TOKEN/);
    assert.throws(() => resolveMode({ STORAGE: 'disk' }), /must be "notion" or "memory"/);
  });

  it('memory storage is inert and the app reports it', async () => {
    assert.deepEqual(memoryStorage().status(), { mode: 'memory', pending: 0, lastError: null, lastSyncAt: null });
    const storage = await createStorage({ env: {}, clock: movableClock(), warn: () => {} });
    assert.equal(storage.mode, 'memory');
    const server = await startServer({ storage });
    try {
      const res = await server.client().get('/api/dev/storage');
      assert.deepEqual(res.body, { mode: 'memory', pending: 0, lastError: null, lastSyncAt: null });
      assert.equal((await startServer().then(async (s) => { const r = await s.client().get('/api/dev/storage'); await s.close(); return r; })).body.mode, 'memory');
    } finally {
      await server.close();
    }
  });
});

describe('seed and verify scripts', () => {
  it('seeds 48 products and 3 promo codes, and a second run writes nothing', async () => {
    const gateway = new FakeNotionGateway();
    const logs = [];
    const first = await runSeed({ env: ENV, gateway, queue: instantQueue(), log: (m) => logs.push(m) });
    assert.equal(first.products.written, 48);
    assert.equal(first.promos.written, 3);
    assert.equal(gateway.table('FC Products').length, 48);
    assert.equal(gateway.table('FC Promo Codes').length, 3);
    const writes = gateway.writes().length;
    const second = await runSeed({ env: ENV, gateway, queue: instantQueue(), log: () => {} });
    assert.deepEqual([second.products.written, second.promos.written], [0, 0]);
    assert.equal(gateway.writes().length, writes);
    assert.match(logs.at(-1), /Seed done/);
  });

  it('--reset archives carts and orders and repairs changed catalog rows', async () => {
    const gateway = await seededGateway();
    const stray = instantQueue();
    const { server } = await boot(gateway);
    const c = server.client();
    await c.post('/api/cart/items', { productId: 19, quantity: 1 });
    await server.close();
    gateway.editRow('FC Products', '19', (d) => ({ ...d, priceCents: 1 }));
    assert.ok(gateway.table('FC Carts').length >= 1);
    const result = await runSeed({ env: ENV, argv: ['--reset'], gateway, queue: stray, log: () => {} });
    assert.equal(result.products.written, 1);
    assert.equal(gateway.table('FC Carts').length, 0);
    assert.ok(result.carts.archived >= 1);
  });

  it('fails clearly without a token and reports a failed write', async () => {
    await assert.rejects(() => runSeed({ env: {}, gateway: new FakeNotionGateway() }), /NOTION_TOKEN is not set/);
    const gateway = new FakeNotionGateway();
    gateway.failNext('createRow', 99, { status: 400, message: 'boom' });
    await assert.rejects(() => runSeed({ env: ENV, gateway, queue: instantQueue(), log: () => {} }), /Seed finished with an error on .*boom/);
  });

  it('verify creates, reads and archives one row', async () => {
    const gateway = new FakeNotionGateway();
    const logs = [];
    assert.equal(await runVerify({ env: ENV, gateway, log: (m) => logs.push(m), now: () => 42 }), true);
    assert.match(logs[0], /^OK:/);
    assert.equal(gateway.table('FC Products').length, 0);
    assert.deepEqual(gateway.writes().map((c) => c.method), ['createRow', 'archiveRow']);
  });

  it('verify reports a missing token, memory mode and an unreadable row', async () => {
    await assert.rejects(() => runVerify({ env: {} }), /NOTION_TOKEN is not set/);
    await assert.rejects(() => runVerify({ env: { ...ENV, STORAGE: 'memory' } }), /nothing to verify/);
    const gateway = new FakeNotionGateway();
    gateway.queryRows = async () => [];
    await assert.rejects(() => runVerify({ env: ENV, gateway, log: () => {} }), /could not read it back/);
  });
});

describe('startup from Notion', () => {
  it('names the missing database and tells the user to seed an empty one', async () => {
    const missing = new FakeNotionGateway({ titles: ['FC Products', 'FC Promo Codes', 'FC Carts'] });
    await assert.rejects(() => createStorage({ env: ENV, clock: movableClock(), gateway: missing, warn: () => {} }), /"FC Orders" was not found/);
    await assert.rejects(
      () => createStorage({ env: ENV, clock: movableClock(), gateway: new FakeNotionGateway(), queue: instantQueue(), warn: () => {} }),
      /FC Products is empty. Run "npm run notion:seed"/,
    );
  });

  it('loads the catalog and promo codes from Notion, not from code', async () => {
    const gateway = await seededGateway();
    gateway.editRow('FC Promo Codes', 'FRESH10', (d) => ({ ...d, value: 50 }));
    gateway.editRow('FC Products', '14', (d) => ({ ...d, name: 'Notion nomi' }));
    const { server } = await boot(gateway, movableClock(), 'off');
    try {
      const c = server.client();
      assert.equal((await c.get('/api/products/14')).body.name, 'Notion nomi');
      await c.post('/api/cart/items', { productId: 14, quantity: 3 });
      const view = await c.post('/api/cart/promo', { code: 'FRESH10' });
      assert.equal(view.body.totals.discountCents, 2100);
    } finally {
      await server.close();
    }
  });

  it('keeps the same catalog as the code seeds', () => {
    const { products, promos } = catalogEntities();
    assert.equal(products.length, PRODUCTS.length);
    assert.deepEqual(promos.map((p) => p.key), Object.keys(PROMOS));
  });

  it('writes carts and orders through to Notion and restores them after a restart', async () => {
    const gateway = await seededGateway();
    const clock = movableClock();
    const first = await boot(gateway, clock, 'off');
    const c = first.server.client();
    await c.post('/api/cart/items', { productId: 14, quantity: 2 });
    await c.post('/api/checkout/delivery', { ...VALID_DELIVERY, slotId: '2026-11-20T12' });
    const paid = await c.post('/api/checkout/pay', VALID_CARD);
    assert.equal(paid.body.number, 'FC-100231');
    const other = first.server.client();
    const kept = await other.post('/api/cart/items', { productId: 19, quantity: 4 });
    await first.storage.queue.idle();

    assert.equal(gateway.table('FC Orders').length, 1);
    assert.equal(gateway.table('FC Orders')[0].key, 'FC-100231');
    assert.equal(gateway.table('FC Carts').length, 2);
    const status = (await c.get('/api/dev/storage')).body;
    assert.deepEqual([status.mode, status.pending, status.lastError], ['notion', 0, null]);
    assert.ok(status.lastSyncAt);
    await first.server.close();

    const second = await boot(gateway, clock, 'off');
    try {
      const again = second.server.client();
      again.cartId = kept.body.cartId;
      const restored = await again.get('/api/cart');
      assert.equal(restored.body.lines[0].quantity, 4);
      assert.equal((await second.server.client().get('/api/orders/FC-100231')).status, 200);
      const next = second.server.client();
      await next.post('/api/cart/items', { productId: 19, quantity: 1 });
      await next.post('/api/checkout/delivery', { ...VALID_DELIVERY, slotId: '2026-11-20T14' });
      assert.equal((await next.post('/api/checkout/pay', VALID_CARD)).body.number, 'FC-100232');
    } finally {
      await second.server.close();
    }
  });

  it('archives expired carts: on startup and when one is read after 7 days', async () => {
    const gateway = await seededGateway();
    const clock = movableClock();
    const first = await boot(gateway, clock);
    const c = first.server.client();
    const made = await c.post('/api/cart/items', { productId: 19, quantity: 1 });
    await first.storage.queue.idle();
    assert.equal(gateway.table('FC Carts').length, 1);
    clock.advance(8 * 24 * 3600 * 1000);
    const fresh = first.server.client();
    fresh.cartId = made.body.cartId;
    const view = await fresh.get('/api/cart');
    assert.equal(view.body.lines.length, 0);
    await first.storage.queue.idle();
    await first.server.close();
    const ids = gateway.table('FC Carts').map((r) => r.key);
    assert.ok(!ids.includes(made.body.cartId));

    gateway.putRecord('FC Carts', 'stale-page', 'old-cart', { id: 'old-cart', lines: [], promoCodes: [], delivery: null, seq: 1, updatedAt: 0 });
    const second = await boot(gateway, clock);
    await second.storage.queue.idle();
    await second.server.close();
    assert.ok(!gateway.table('FC Carts').some((r) => r.key === 'old-cart'));
  });

  it('survives a failing write: the app keeps answering and the status shows the error', async () => {
    const gateway = await seededGateway();
    const { server, storage } = await boot(gateway);
    try {
      gateway.failNext('createRow', 99, { status: 400, message: 'Notion said no' });
      const c = server.client();
      assert.equal((await c.post('/api/cart/items', { productId: 19, quantity: 1 })).status, 200);
      await storage.queue.idle();
      const status = (await c.get('/api/dev/storage')).body;
      assert.equal(status.lastError.message, 'Notion said no');
      assert.equal((await c.get('/api/products')).status, 200);
    } finally {
      await server.close();
    }
  });
});
