import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CHUNK_SIZE, MAX_ITEMS, chunkText, fromRichText, toRichText } from '../src/storage/chunk.js';
import { NotionEntityStore } from '../src/storage/NotionEntityStore.js';
import { parseRow, rowProperties } from '../src/storage/rows.js';
import { WriteQueue, isRetryable } from '../src/storage/WriteQueue.js';
import { FakeNotionGateway } from './fakeGateway.js';

/** A queue on a virtual clock: sleeping advances time and records the wait. */
function virtualQueue(options = {}) {
  let t = 0;
  const waits = [];
  const queue = new WriteQueue({
    minIntervalMs: 350,
    sleep: async (ms) => {
      waits.push(ms);
      t += ms;
    },
    now: () => t,
    ...options,
  });
  return { queue, waits };
}
const instantQueue = () => new WriteQueue({ minIntervalMs: 0, sleep: async () => {} });

describe('chunking of rich text', () => {
  it('splits long text into pieces of at most 2000 characters and joins them back', () => {
    const text = 'x'.repeat(4500);
    const chunks = chunkText(text);
    assert.deepEqual(chunks.map((c) => c.length), [2000, 2000, 500]);
    assert.equal(fromRichText(toRichText(text)), text);
    assert.equal(CHUNK_SIZE, 2000);
  });

  it('never cuts a surrogate pair in half', () => {
    const text = `${'a'.repeat(1999)}😀b`;
    const [first, second] = chunkText(text);
    assert.equal(first.length, 1999);
    assert.equal(second, '😀b');
  });

  it('handles empty text, text that is too large and odd inputs', () => {
    assert.deepEqual(chunkText(''), []);
    assert.deepEqual(chunkText(undefined), []);
    assert.deepEqual(toRichText(''), []);
    assert.throws(() => chunkText('a'.repeat(CHUNK_SIZE * (MAX_ITEMS + 1))), RangeError);
    assert.equal(fromRichText(null), '');
    assert.equal(fromRichText([{ text: { content: 'abc' } }, { plain_text: 'def' }]), 'abcdef');
  });
});

describe('rows', () => {
  it('round-trips a record through Notion properties', () => {
    const data = { id: 7, name: "Qo'ziqorin", lines: Array.from({ length: 300 }, (_, i) => ({ i, note: 'sut' })) };
    const props = rowProperties('7', 'summary '.repeat(500), data);
    assert.ok(props.Data.rich_text.length > 1);
    assert.ok(props.Summary.rich_text.every((i) => i.text.content.length <= 2000));
    const parsed = parseRow({ id: 'p1', properties: props });
    assert.deepEqual(parsed, { key: '7', pageId: 'p1', data });
  });

  it('returns null for rows without a key or with broken JSON', () => {
    assert.equal(parseRow({ id: 'p', properties: {} }), null);
    assert.equal(parseRow(undefined), null);
    const broken = rowProperties('k', '', { a: 1 });
    broken.Data = { rich_text: [{ text: { content: '{nope' } }] };
    assert.equal(parseRow({ id: 'p', properties: broken }), null);
  });
});

describe('WriteQueue', () => {
  it('runs jobs one at a time in the order they were queued', async () => {
    const queue = instantQueue();
    const log = [];
    const job = (name) => async () => {
      log.push(`start ${name}`);
      await Promise.resolve();
      log.push(`end ${name}`);
    };
    await Promise.all([queue.enqueue('a', job('a')), queue.enqueue('b', job('b')), queue.enqueue('c', job('c'))]);
    assert.deepEqual(log, ['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
    assert.equal(queue.pending, 0);
  });

  it('replaces a job that is still waiting for the same key and resolves both callers', async () => {
    const queue = instantQueue();
    const ran = [];
    const first = queue.enqueue('a', async () => ran.push('a'));
    const old = queue.enqueue('b', async () => ran.push('b1'));
    const latest = queue.enqueue('b', async () => ran.push('b2'));
    assert.equal(queue.pending, 2);
    await Promise.all([first, old, latest]);
    assert.deepEqual(ran, ['a', 'b2']);
  });

  it('keeps at least 350 ms between calls', async () => {
    const { queue, waits } = virtualQueue();
    await Promise.all([queue.enqueue('a', async () => {}), queue.enqueue('b', async () => {}), queue.enqueue('c', async () => {})]);
    assert.deepEqual(waits, [350, 350]);
    assert.ok(queue.status().lastSyncAt);
  });

  it('retries a rate limit and honours Retry-After', async () => {
    const { queue, waits } = virtualQueue();
    let calls = 0;
    await queue.enqueue('a', async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error('rate limited'), { status: 429, retryAfterMs: 1000 });
    });
    assert.equal(calls, 3);
    assert.equal(waits.filter((w) => w === 1000).length, 2);
    assert.equal(queue.lastError, null);
  });

  it('backs off exponentially when there is no Retry-After', async () => {
    const { queue, waits } = virtualQueue({ minIntervalMs: 0 });
    let calls = 0;
    await queue.enqueue('a', async () => {
      calls += 1;
      if (calls < 4) throw Object.assign(new Error('busy'), { status: 503 });
    });
    assert.deepEqual(waits, [500, 1000, 2000]);
  });

  it('gives up after 5 attempts, records the error and carries on with the next job', async () => {
    const { queue } = virtualQueue({ minIntervalMs: 0 });
    let calls = 0;
    let next = false;
    await Promise.all([
      queue.enqueue('bad', async () => {
        calls += 1;
        throw Object.assign(new Error('down'), { status: 500 });
      }),
      queue.enqueue('good', async () => {
        next = true;
      }),
    ]);
    assert.equal(calls, 5);
    assert.equal(next, true);
    assert.equal(queue.lastError.key, 'bad');
    assert.equal(queue.lastError.attempts, 5);
    assert.equal(queue.lastError.message, 'down');
  });

  it('does not retry errors that cannot succeed later', async () => {
    const queue = instantQueue();
    let calls = 0;
    await queue.enqueue('a', async () => {
      calls += 1;
      throw Object.assign(new Error('validation'), { status: 400 });
    });
    assert.equal(calls, 1);
    assert.equal(queue.status().lastError.message, 'validation');
    await queue.enqueue('b', async () => {
      throw 'plain string';
    });
    assert.equal(queue.status().lastError.message, 'plain string');
  });

  it('idle resolves once the queue is empty', async () => {
    const queue = instantQueue();
    await queue.idle();
    queue.enqueue('a', async () => {});
    queue.enqueue('b', async () => {});
    await queue.idle();
    assert.equal(queue.pending, 0);
  });

  it('classifies retryable errors', () => {
    assert.equal(isRetryable({ status: 429 }), true);
    assert.equal(isRetryable({ status: 502 }), true);
    assert.equal(isRetryable({ code: 'ECONNRESET' }), true);
    assert.equal(isRetryable({ code: 'notionhq_client_request_timeout' }), true);
    assert.equal(isRetryable({ status: 400 }), false);
    assert.equal(isRetryable(null), false);
  });
});

describe('NotionEntityStore', () => {
  async function setup() {
    const gateway = new FakeNotionGateway();
    const warnings = [];
    const store = new NotionEntityStore({
      gateway,
      queue: instantQueue(),
      dataSourceId: await gateway.resolveDataSource('p', 'FC Products'),
      title: 'FC Products',
      warn: (m) => warnings.push(m),
    });
    return { gateway, store, warnings };
  }

  it('loads rows and skips unreadable ones with a warning', async () => {
    const { gateway, store, warnings } = await setup();
    await store.upsert('1', { id: 1 }, 'one');
    gateway.putRaw('FC Products', 'bad-page', { Key: { title: [{ plain_text: 'bad' }] }, Data: { rich_text: [{ plain_text: '{x' }] } });
    const records = await store.load();
    assert.deepEqual(records, [{ key: '1', data: { id: 1 } }]);
    assert.match(warnings[0], /skipped an unreadable row \(bad-page\)/);
    assert.deepEqual(store.keys(), ['1']);
  });

  it('creates a row first and updates it afterwards', async () => {
    const { gateway, store } = await setup();
    await store.upsert('1', { v: 1 }, 's');
    await store.upsert('1', { v: 2 }, 's');
    assert.deepEqual(gateway.writes().map((c) => c.method), ['createRow', 'updateRow']);
    assert.deepEqual(gateway.table('FC Products')[0].data, { v: 2 });
  });

  it('writes only the latest state when updates arrive back to back', async () => {
    const { gateway, store } = await setup();
    await Promise.all([store.upsert('1', { v: 1 }), store.upsert('1', { v: 2 }), store.upsert('1', { v: 3 })]);
    assert.deepEqual(gateway.table('FC Products')[0].data, { v: 3 });
    assert.ok(gateway.writes().length <= 2);
  });

  it('archives a row and ignores unknown keys', async () => {
    const { gateway, store } = await setup();
    await store.upsert('1', { v: 1 });
    await store.archive('1');
    await store.archive('never-existed');
    assert.equal(gateway.table('FC Products').length, 0);
    assert.deepEqual(store.keys(), []);
  });

  it('syncs: writes new rows, skips identical ones, updates changed ones and prunes extras', async () => {
    const { gateway, store } = await setup();
    const rows = [1, 2, 3].map((n) => ({ key: String(n), data: { n }, summary: `n${n}` }));
    assert.deepEqual(await store.sync(rows), { written: 3, archived: 0 });
    await store.load();
    const before = gateway.writes().length;
    assert.deepEqual(await store.sync(rows), { written: 0, archived: 0 });
    assert.equal(gateway.writes().length, before);
    const changed = [{ ...rows[0], data: { n: 99 } }, rows[1]];
    assert.deepEqual(await store.sync(changed, { prune: true }), { written: 1, archived: 1 });
    assert.deepEqual(gateway.table('FC Products').map((r) => r.key).sort(), ['1', '2']);
  });
});
