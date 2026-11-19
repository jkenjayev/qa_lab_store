import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createSeed } from '../src/data/seed.js';
import { hashPassword } from '../src/domain/password.js';
import { MAX_CHUNK, MAX_ITEMS, chunkText, joinChunks } from '../src/storage/chunk.js';
import { SHARED_HASH_SENTINEL, createCollections, seedFromSnapshot, snapshotFromSeed } from '../src/storage/collections.js';
import { runSeed, runVerify } from '../src/storage/commands.js';
import { collectionsFor, createMemoryStorage, createStorage } from '../src/storage/createStorage.js';
import { NotionStore } from '../src/storage/NotionStore.js';
import { SdkNotionGateway } from '../src/storage/SdkNotionGateway.js';
import { DEFAULT_PARENT_PAGE_ID, loadEnvLocal } from '../src/storage/settings.js';
import { WriteQueue, isRetryable, retryDelay } from '../src/storage/WriteQueue.js';
import { ALL_TITLES, FakeNotionGateway } from './fakeGateway.js';
import { TEST_PASSWORD } from './helpers.js';

const fastQueue = () => new WriteQueue({ minIntervalMs: 0, baseDelayMs: 1, sleep: async () => {} });
const silent = () => {};

// ---------- chunk
test('chunkText splits at 2000 characters and joinChunks restores the text', () => {
  const text = 'ŭ'.repeat(MAX_CHUNK * 2 + 5);
  const chunks = chunkText(text);
  assert.deepEqual(chunks.map((c) => c.length), [MAX_CHUNK, MAX_CHUNK, 5]);
  assert.equal(joinChunks(chunks), text);
  assert.deepEqual(chunkText(''), []);
});

test('chunkText refuses a record that cannot fit one property', () => {
  assert.throws(() => chunkText('x'.repeat(MAX_CHUNK * MAX_ITEMS + 1)), RangeError);
});

// ---------- queue
test('WriteQueue runs jobs one at a time in order and keeps the minimum gap', async () => {
  let clock = 1000;
  const sleeps = [];
  const queue = new WriteQueue({ minIntervalMs: 350, now: () => clock, sleep: async (ms) => { sleeps.push(ms); clock += ms; } });
  const order = [];
  const jobs = [1, 2, 3].map((n) => queue.enqueue(`job ${n}`, async () => { order.push(n); return n; }));
  assert.equal(queue.pending, 3);
  assert.deepEqual(await Promise.all(jobs), [1, 2, 3]);
  assert.deepEqual(order, [1, 2, 3]);
  assert.deepEqual(sleeps, [350, 350]); // first call needs no wait
  assert.equal(queue.pending, 0);
  assert.ok(queue.lastSyncAt);
});

test('WriteQueue retries transient errors, honours Retry-After and then succeeds', async () => {
  const sleeps = [];
  const queue = new WriteQueue({ minIntervalMs: 0, baseDelayMs: 100, sleep: async (ms) => { sleeps.push(ms); } });
  let tries = 0;
  const result = await queue.enqueue('flaky', async () => {
    tries += 1;
    if (tries === 1) throw Object.assign(new Error('slow down'), { status: 429, headers: { 'retry-after': '2' } });
    if (tries === 2) throw Object.assign(new Error('oops'), { status: 503 });
    return 'ok';
  });
  assert.equal(result, 'ok');
  assert.equal(tries, 3);
  assert.deepEqual(sleeps, [2000, 200]);
});

test('WriteQueue gives up after the last attempt, records the error and keeps working', async () => {
  const queue = new WriteQueue({ minIntervalMs: 0, maxAttempts: 2, sleep: async () => {} });
  await assert.rejects(queue.enqueue('always fails', async () => { throw Object.assign(new Error('down'), { status: 500 }); }), /down/);
  assert.equal(queue.lastError.label, 'always fails');
  assert.match(queue.lastError.message, /down/);
  await assert.rejects(queue.enqueue('bad request', async () => { throw Object.assign(new Error('nope'), { status: 400 }); }), /nope/);
  assert.equal(await queue.enqueue('fine', async () => 7), 7);
  await queue.idle();
  assert.equal(queue.pending, 0);
});

test('isRetryable and retryDelay classify errors', () => {
  assert.equal(isRetryable({ status: 429 }), true);
  assert.equal(isRetryable({ status: 502 }), true);
  assert.equal(isRetryable({ code: 'rate_limited' }), true);
  assert.equal(isRetryable({ code: 'ECONNRESET' }), true);
  assert.equal(isRetryable({ status: 404 }), false);
  assert.equal(isRetryable(undefined), false);
  assert.equal(retryDelay({ headers: { 'retry-after': '3' } }, 1, 500), 3000);
  assert.equal(retryDelay({ headers: new Headers({ 'retry-after': '1' }) }, 1, 500), 1000);
  assert.equal(retryDelay({}, 3, 500), 2000);
  assert.equal(retryDelay({ headers: { 'retry-after': 'soon' } }, 1, 500), 500);
});

test('the default WriteQueue constructor works with real timers', async () => {
  const queue = new WriteQueue({ minIntervalMs: 1 });
  assert.equal(await queue.enqueue('x', async () => 1), 1);
});

// ---------- collections
test('collections name rows, never store the staff hash and keep a patient\'s own hash', () => {
  const own = hashPassword('another-value');
  const shared = hashPassword(TEST_PASSWORD);
  const collections = collectionsFor(TEST_PASSWORD);
  const by = Object.fromEntries(collections.map((c) => [c.name, c]));
  assert.deepEqual(collections.map((c) => c.title), ALL_TITLES);

  assert.equal(by.doctors.summary({ name: 'Dr. A. Rao', specialty: 'Kardiologiya', years: 14 }), 'Dr. A. Rao | Kardiologiya | 14 yil');
  const schedule = { doctorId: 'doctor-1', schedule: { slotMinutes: 30, days: { 0: { off: true }, 1: { off: false, start: '09:00', end: '17:00' } } } };
  assert.match(by.schedules.summary(schedule), /Yak dam; Du 09:00-17:00.*\(30 daq\)/);
  assert.equal(by.schedules.key(schedule), 'doctor-1');
  assert.equal(by.appointments.key({ reference: 'CB-1' }), 'CB-1');
  assert.match(by.appointments.summary({ reference: 'CB-1', date: '2026-11-19', time: '10:30', doctorId: 'd', patientId: 'p', status: 'Booked' }), /CB-1 \| 2026-11-19 10:30/);
  assert.equal(by.emails.key({ n: 4 }), 'email-4');
  assert.equal(by.emails.summary({ to: 'a@b', subject: 'S' }), 'a@b | S');
  assert.equal(by.staff.summary({ name: 'N', email: 'e', role: 'Admin' }), 'N | e | Admin');

  assert.equal(by.patients.serialize({ id: 'p1', passwordHash: shared }, undefined).passwordHash, null);
  assert.equal(by.patients.serialize({ id: 'p1', passwordHash: SHARED_HASH_SENTINEL }).passwordHash, null);
  assert.equal(by.patients.serialize({ id: 'p2', passwordHash: own }).passwordHash, own);
  assert.equal(by.patients.deserialize({ id: 'p1', passwordHash: null }, { sharedHash: 'H' }).passwordHash, 'H');
  assert.equal(by.patients.deserialize({ id: 'p2', passwordHash: own }, { sharedHash: 'H' }).passwordHash, own);
  assert.equal('passwordHash' in by.staff.serialize({ id: 's', passwordHash: shared, email: 'e' }), false);
  assert.equal(by.staff.deserialize({ id: 's' }, { sharedHash: 'H' }).passwordHash, 'H');
  assert.deepEqual(createCollections({ isSharedHash: () => false }).length, 6);
});

test('snapshotFromSeed and seedFromSnapshot are inverse', () => {
  const seed = { ...createSeed({ passwordHash: 'h' }), outbox: [{ to: 'a', subject: 's', body: 'b', sentAt: 't' }] };
  const snapshot = snapshotFromSeed(seed);
  assert.equal(snapshot.schedules.length, 12);
  assert.deepEqual(snapshot.emails, [{ n: 1, to: 'a', subject: 's', body: 'b', sentAt: 't' }]);
  const back = seedFromSnapshot({ ...snapshot, emails: [{ n: 2, to: 'x' }, { n: 1, to: 'a' }] });
  assert.deepEqual(back.schedules, seed.schedules);
  assert.deepEqual(back.outbox, [{ to: 'a' }, { to: 'x' }]);
  assert.equal(snapshotFromSeed(createSeed({ passwordHash: 'h' })).emails.length, 0);
});

// ---------- store
function makeStore(gateway = new FakeNotionGateway({ titles: ALL_TITLES }), logs = []) {
  const store = new NotionStore({
    gateway,
    queue: fastQueue(),
    collections: collectionsFor(TEST_PASSWORD),
    parentPageId: 'parent',
    ctx: { sharedHash: 'SHARED' },
    log: (line) => logs.push(line),
  });
  return { store, gateway, logs };
}

const doctor = { id: 'doctor-1', name: 'Dr. A. Rao', specialty: 'Kardiologiya', years: 14 };

test('NotionStore creates, updates, skips unchanged and archives rows', async () => {
  const { store, gateway } = makeStore();
  await store.loadAll();
  assert.equal(await store.upsert('doctors', doctor), true);
  assert.deepEqual(gateway.rows('CB Doctors'), { 'doctor-1': doctor });
  const callsAfterCreate = gateway.calls.length;
  await store.upsert('doctors', doctor); // same data: no call
  assert.equal(gateway.calls.length, callsAfterCreate);
  await store.upsert('doctors', { ...doctor, years: 15 });
  assert.equal(gateway.rows('CB Doctors')['doctor-1'].years, 15);
  await store.remove('doctors', 'doctor-1');
  assert.deepEqual(gateway.rows('CB Doctors'), {});
  assert.equal(await store.remove('doctors', 'doctor-1'), true); // already gone
  assert.equal(store.status().mode, 'notion');
});

test('NotionStore update queued right after create waits for the page id', async () => {
  const { store, gateway } = makeStore();
  await store.loadAll();
  const a = store.upsert('doctors', doctor);
  const b = store.upsert('doctors', { ...doctor, years: 99 });
  const c = store.remove('doctors', 'doctor-1');
  assert.deepEqual(await Promise.all([a, b, c]), [true, true, true]);
  assert.equal([...gateway.pages.values()].filter((p) => !p.trashed).length, 0);
  assert.equal(gateway.pages.size, 1); // created once, not twice
});

test('NotionStore survives a failed create and retries it on the next upsert', async () => {
  const logs = [];
  const { store, gateway } = makeStore(undefined, logs);
  await store.loadAll();
  gateway.failures.createRow = { count: 1, status: 400, message: 'rejected' };
  assert.equal(await store.upsert('doctors', doctor), false);
  assert.match(logs.at(-1), /Notion write failed .*rejected/);
  assert.equal(store.status().lastError.label, 'create CB Doctors doctor-1');
  assert.equal(await store.upsert('doctors', doctor), true);
  assert.deepEqual(Object.keys(gateway.rows('CB Doctors')), ['doctor-1']);
});

test('NotionStore reports an update on a row that was never created', async () => {
  const { store, gateway } = makeStore();
  await store.loadAll();
  gateway.failures.createRow = { count: 1, status: 400 };
  const first = store.upsert('doctors', doctor);
  const second = store.upsert('doctors', { ...doctor, years: 1 });
  const third = store.remove('doctors', 'doctor-1');
  assert.deepEqual(await Promise.all([first, second, third]), [false, false, false]);
});

test('NotionStore loads rows, skips unreadable ones and replaceAll syncs to a snapshot', async () => {
  const gateway = new FakeNotionGateway({ titles: ALL_TITLES });
  await gateway.createRow('ds:CB Doctors', { key: 'doctor-1', summary: 's', data: JSON.stringify(doctor) });
  await gateway.createRow('ds:CB Doctors', { key: 'broken', summary: 's', data: '{not json' });
  await gateway.createRow('ds:CB Doctors', { key: 'extra', summary: 's', data: JSON.stringify({ id: 'extra' }) });
  const logs = [];
  const { store } = makeStore(gateway, logs);
  const snapshot = await store.loadAll();
  assert.deepEqual(snapshot.doctors.map((d) => d.id), ['doctor-1', 'extra']);
  assert.match(logs[0], /Skipping unreadable row broken in CB Doctors/);

  const liveKeys = () => [...gateway.pages.values()].filter((p) => p.source === 'ds:CB Doctors' && !p.trashed).map((p) => p.key).sort();
  await store.replaceAll({ doctors: [doctor, { ...doctor, id: 'doctor-2' }] });
  assert.deepEqual(liveKeys(), ['broken', 'doctor-1', 'doctor-2']); // 'extra' archived, unreadable 'broken' left alone
  await store.replaceAll({ doctors: [] }, { archiveExtras: false });
  assert.deepEqual(liveKeys(), ['broken', 'doctor-1', 'doctor-2']);
  await store.flush();
});

test('NotionStore handles a long record through chunking', async () => {
  const { store, gateway } = makeStore();
  await store.loadAll();
  const long = { ...doctor, notes: 'ŭ'.repeat(5000) };
  await store.upsert('doctors', long);
  assert.equal(gateway.rows('CB Doctors')['doctor-1'].notes.length, 5000);
});

// ---------- createStorage
test('memory storage reports its status and ignores writes', async () => {
  const storage = createMemoryStorage();
  storage.sink.upsert('doctors', doctor);
  storage.sink.remove('doctors', 'x');
  storage.sink.replaceAll({});
  assert.deepEqual(storage.status(), { mode: 'memory', pending: 0, lastError: null, lastSyncAt: null });
  assert.equal(storage.initialData, null);
  await storage.flush();
});

test('createStorage defaults to memory with a warning when there is no token', async () => {
  const logs = [];
  const storage = await createStorage({ env: {}, trainingPassword: TEST_PASSWORD, log: (l) => logs.push(l) });
  assert.equal(storage.mode, 'memory');
  assert.match(logs[0], /NOT stored in Notion/);
  const quiet = [];
  await createStorage({ env: { STORAGE: 'memory' }, trainingPassword: TEST_PASSWORD, log: (l) => quiet.push(l) });
  assert.deepEqual(quiet, []);
});

test('createStorage rejects an unknown mode and notion without a token', async () => {
  await assert.rejects(createStorage({ env: { STORAGE: 'disk' }, trainingPassword: 'x' }), /STORAGE must be notion or memory/);
  await assert.rejects(createStorage({ env: { STORAGE: 'notion' }, trainingPassword: 'x' }), /needs NOTION_TOKEN/);
});

test('createStorage with Notion asks for the seed command when the databases are empty', async () => {
  const gateway = new FakeNotionGateway({ titles: ALL_TITLES });
  await assert.rejects(
    createStorage({ env: { NOTION_TOKEN: 'placeholder' }, trainingPassword: TEST_PASSWORD, gatewayFactory: () => gateway, queue: fastQueue(), log: silent }),
    /empty\. Run: npm run notion:seed/,
  );
});

test('createStorage reports a missing database by name', async () => {
  const gateway = new FakeNotionGateway({ titles: ALL_TITLES, missing: ['CB Staff'] });
  await assert.rejects(
    createStorage({ env: { NOTION_TOKEN: 'placeholder' }, trainingPassword: TEST_PASSWORD, gatewayFactory: () => gateway, queue: fastQueue(), log: silent }),
    /CB Staff/,
  );
});

// ---------- commands
test('runSeed fills the databases, is idempotent and never stores password hashes', async () => {
  const gateway = new FakeNotionGateway({ titles: ALL_TITLES });
  const env = { NOTION_TOKEN: 'placeholder' };
  const logs = [];
  const first = await runSeed({ env, gatewayFactory: () => gateway, queue: fastQueue(), log: (l) => logs.push(l) });
  assert.equal(first.written, 92); // 12 doctors + 12 schedules + 57 appointments + 8 patients + 3 staff
  assert.equal(Object.keys(gateway.rows('CB Doctors')).length, 12);
  assert.equal(Object.keys(gateway.rows('CB Appointments')).length, 57);
  assert.equal(Object.keys(gateway.rows('CB Schedules')).length, 12);
  assert.equal(Object.keys(gateway.rows('CB Staff')).length, 3);
  assert.match(logs.at(-1), /0 failed/);
  for (const row of Object.values(gateway.rows('CB Patients'))) assert.equal(row.passwordHash, null);
  for (const row of Object.values(gateway.rows('CB Staff'))) assert.equal('passwordHash' in row, false);

  const callsBefore = gateway.calls.length;
  await runSeed({ env, gatewayFactory: () => gateway, queue: fastQueue(), log: silent });
  const writes = gateway.calls.slice(callsBefore).filter((c) => c === 'createRow' || c === 'updateRow');
  assert.equal(writes.length, 0);
});

test('runSeed reports rows that could not be written', async () => {
  const gateway = new FakeNotionGateway({ titles: ALL_TITLES });
  gateway.failures.createRow = { count: 1, status: 400, message: 'rejected' };
  await assert.rejects(runSeed({ env: { NOTION_TOKEN: 'x' }, gatewayFactory: () => gateway, queue: fastQueue(), log: silent }), /1 rows could not be written/);
});

test('commands need a token', async () => {
  await assert.rejects(runSeed({ env: {} }), /NOTION_TOKEN is not set/);
  await assert.rejects(runVerify({ env: {} }), /NOTION_TOKEN is not set/);
});

test('runVerify writes, reads back and archives a temporary row', async () => {
  const gateway = new FakeNotionGateway({ titles: ['CB Doctors'] });
  const logs = [];
  assert.deepEqual(await runVerify({ env: { NOTION_TOKEN: 'x' }, gatewayFactory: () => gateway, log: (l) => logs.push(l) }), { ok: true });
  assert.match(logs[0], /^OK/);
  assert.deepEqual(gateway.rows('CB Doctors'), {});
  const broken = new FakeNotionGateway({ titles: ['CB Doctors'] });
  broken.listRows = async () => [];
  await assert.rejects(runVerify({ env: { NOTION_TOKEN: 'x' }, gatewayFactory: () => broken, log: silent }), /could not be read back/);
});

// ---------- sdk gateway
const page = (id, key, chunks, trashed = false) => ({
  id,
  in_trash: trashed,
  properties: { Key: { title: [{ plain_text: key }] }, Data: { rich_text: chunks.map((plain_text) => ({ plain_text })) } },
});

function fakeClient(calls = []) {
  return {
    blocks: {
      children: {
        list: async (args) => {
          calls.push(['list', args]);
          return args.start_cursor
            ? { results: [{ type: 'child_database', id: 'db-2', child_database: { title: 'CB Staff' } }], has_more: false }
            : { results: [{ type: 'paragraph' }, { type: 'child_database', id: 'db-1', child_database: { title: 'CB Doctors' } }], has_more: true, next_cursor: 'c2' };
        },
      },
    },
    databases: { retrieve: async ({ database_id }) => ({ data_sources: database_id === 'db-0' ? [] : [{ id: `ds-of-${database_id}` }] }) },
    dataSources: {
      query: async (args) => {
        calls.push(['query', args]);
        return args.start_cursor
          ? { results: [page('p2', 'k2', ['{"b":', '2}'])], has_more: false }
          : { results: [page('p1', 'k1', ['{"a":1}']), page('p3', 'gone', ['{}'], true), { id: 'partial' }], has_more: true, next_cursor: 'n' };
      },
    },
    pages: {
      create: async (args) => { calls.push(['create', args]); return { id: 'new-page' }; },
      update: async (args) => { calls.push(['update', args]); return {}; },
    },
  };
}

test('SdkNotionGateway finds databases by title across pages and returns data source ids', async () => {
  const gateway = new SdkNotionGateway('token', fakeClient());
  assert.deepEqual(await gateway.resolveCollections('parent', ['CB Doctors', 'CB Staff']), { 'CB Doctors': 'ds-of-db-1', 'CB Staff': 'ds-of-db-2' });
  await assert.rejects(gateway.resolveCollections('parent', ['CB Doctors', 'Nope']), /not found under page parent: Nope/);
});

test('SdkNotionGateway reports a database without a data source', async () => {
  const client = fakeClient();
  client.blocks.children.list = async () => ({ results: [{ type: 'child_database', id: 'db-0', child_database: { title: 'CB Doctors' } }], has_more: false });
  await assert.rejects(new SdkNotionGateway('t', client).resolveCollections('p', ['CB Doctors']), /has no data source/);
});

test('SdkNotionGateway reads rows page by page, joins chunks and skips trashed or partial pages', async () => {
  const calls = [];
  const rows = await new SdkNotionGateway('token', fakeClient(calls)).listRows('ds-1');
  assert.deepEqual(rows, [
    { pageId: 'p1', key: 'k1', data: '{"a":1}' },
    { pageId: 'p2', key: 'k2', data: '{"b":2}' },
  ]);
  assert.equal(calls.filter(([n]) => n === 'query').length, 2);
});

test('SdkNotionGateway writes Key, Summary and chunked Data and trashes archived rows', async () => {
  const calls = [];
  const gateway = new SdkNotionGateway('token', fakeClient(calls));
  const data = 'x'.repeat(4500);
  assert.equal(await gateway.createRow('ds-1', { key: 'k', summary: 'y'.repeat(3000), data }), 'new-page');
  const create = calls.find(([n]) => n === 'create')[1];
  assert.deepEqual(create.parent, { type: 'data_source_id', data_source_id: 'ds-1' });
  assert.equal(create.properties.Key.title[0].text.content, 'k');
  assert.equal(create.properties.Summary.rich_text[0].text.content.length, 2000);
  assert.deepEqual(create.properties.Data.rich_text.map((i) => i.text.content.length), [2000, 2000, 500]);
  await gateway.updateRow('page-9', { summary: 's', data: '{}' });
  const update = calls.find(([n]) => n === 'update')[1];
  assert.equal(update.page_id, 'page-9');
  assert.deepEqual(Object.keys(update.properties), ['Summary', 'Data']);
  await gateway.archiveRow('page-9');
  assert.equal(calls.filter(([n]) => n === 'update').at(-1)[1].in_trash, true);
});

test('SdkNotionGateway builds its own client from a token', () => {
  assert.ok(new SdkNotionGateway('placeholder').client);
});

// ---------- settings
test('loadEnvLocal reads a file into process.env and ignores a missing file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cb-env-'));
  const file = join(dir, '.env.local');
  assert.equal(loadEnvLocal(join(dir, 'missing')), false);
  writeFileSync(file, 'CB_TEST_ONLY_VALUE=from-file\n');
  try {
    assert.equal(loadEnvLocal(file), true);
    assert.equal(process.env.CB_TEST_ONLY_VALUE, 'from-file');
    assert.equal(loadEnvLocal(file, {}), false);
  } finally {
    delete process.env.CB_TEST_ONLY_VALUE;
    rmSync(dir, { recursive: true, force: true });
  }
  assert.match(DEFAULT_PARENT_PAGE_ID, /^41d2b9c9-59ab-81b3/);
});
