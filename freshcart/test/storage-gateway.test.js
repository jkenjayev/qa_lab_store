import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { DEFAULT_PARENT_PAGE_ID, loadEnvLocal } from '../src/storage/env.js';
import { SdkNotionGateway } from '../src/storage/SdkNotionGateway.js';

/** A stub of the parts of the Notion client the gateway uses; every call is logged. */
function stubClient(overrides = {}) {
  const calls = [];
  const record = (name, result) => async (args) => {
    calls.push({ name, args });
    return typeof result === 'function' ? result(args) : result;
  };
  const client = {
    calls,
    blocks: { children: { list: record('blocks.children.list', { results: [], has_more: false }) } },
    databases: { retrieve: record('databases.retrieve', { data_sources: [{ id: 'ds-9' }] }) },
    dataSources: { query: record('dataSources.query', { results: [], has_more: false }) },
    pages: { create: record('pages.create', { id: 'new-page' }), update: record('pages.update', {}) },
    ...overrides,
  };
  return client;
}

describe('SdkNotionGateway', () => {
  it('finds a child database by title across pages and returns its data source id', async () => {
    let page = 0;
    const client = stubClient({
      blocks: {
        children: {
          list: async (args) => {
            client.calls.push({ name: 'list', args });
            page += 1;
            return page === 1
              ? { results: [{ type: 'paragraph' }, { type: 'child_database', id: 'x', child_database: { title: 'Other' } }], has_more: true, next_cursor: 'c2' }
              : { results: [{ type: 'child_database', id: 'db-1', child_database: { title: 'FC Carts' } }], has_more: false };
          },
        },
      },
    });
    const gateway = new SdkNotionGateway('t', client);
    assert.equal(await gateway.resolveDataSource('parent', 'FC Carts'), 'ds-9');
    assert.equal(client.calls.find((c) => c.name === 'databases.retrieve').args.database_id, 'db-1');
    assert.equal(client.calls[1].args.start_cursor, 'c2');
  });

  it('explains a missing database and a database without a data source', async () => {
    const gateway = new SdkNotionGateway('t', stubClient());
    await assert.rejects(() => gateway.resolveDataSource('parent-id', 'FC Orders'), /"FC Orders" was not found on Notion page parent-id.*Share that page/);
    const client = stubClient({
      blocks: { children: { list: async () => ({ results: [{ type: 'child_database', id: 'db', child_database: { title: 'T' } }], has_more: false }) } },
      databases: { retrieve: async () => ({ data_sources: [] }) },
    });
    await assert.rejects(() => new SdkNotionGateway('t', client).resolveDataSource('p', 'T'), /has no data source/);
  });

  it('queries every page of rows and skips trashed rows and non-pages', async () => {
    let n = 0;
    const client = stubClient({
      dataSources: {
        query: async () => {
          n += 1;
          return n === 1
            ? { results: [{ object: 'page', id: 'a', properties: { k: 1 } }, { object: 'page', id: 'gone', in_trash: true }, { object: 'data_source' }], has_more: true, next_cursor: 'c' }
            : { results: [{ object: 'page', id: 'b', properties: {} }, { object: 'page', id: 'old', archived: true }], has_more: false };
        },
      },
    });
    const rows = await new SdkNotionGateway('t', client).queryRows('ds');
    assert.deepEqual(rows.map((r) => r.id), ['a', 'b']);
  });

  it('creates and updates pages under the data source', async () => {
    const client = stubClient();
    const gateway = new SdkNotionGateway('t', client);
    assert.deepEqual(await gateway.createRow('ds-1', { Key: {} }), { id: 'new-page' });
    await gateway.updateRow('page-1', { Key: {} });
    assert.deepEqual(client.calls[0].args, { parent: { type: 'data_source_id', data_source_id: 'ds-1' }, properties: { Key: {} } });
    assert.deepEqual(client.calls[1].args, { page_id: 'page-1', properties: { Key: {} } });
  });

  it('archives with archived on the default API version and in_trash on newer ones', async () => {
    const oldClient = stubClient();
    await new SdkNotionGateway('t', oldClient).archiveRow('p');
    assert.deepEqual(oldClient.calls[0].args, { page_id: 'p', archived: true });
    const newClient = stubClient({ notionVersion: '2026-03-11' });
    await new SdkNotionGateway('t', newClient).archiveRow('p');
    assert.deepEqual(newClient.calls[0].args, { page_id: 'p', in_trash: true });
  });

  it('turns a Retry-After header into retryAfterMs on the thrown error', async () => {
    const limited = (headers) => stubClient({ pages: { update: async () => { throw Object.assign(new Error('429'), { status: 429, headers }); } } });
    await assert.rejects(() => new SdkNotionGateway('t', limited({ 'retry-after': '2' })).updateRow('p', {}), (e) => e.retryAfterMs === 2000);
    await assert.rejects(() => new SdkNotionGateway('t', limited(new Headers({ 'retry-after': '3' }))).updateRow('p', {}), (e) => e.retryAfterMs === 3000);
    await assert.rejects(() => new SdkNotionGateway('t', limited({ 'retry-after': 'soon' })).updateRow('p', {}), (e) => e.retryAfterMs === undefined);
    await assert.rejects(() => new SdkNotionGateway('t', stubClient({ pages: { update: async () => { throw 'text'; } } })).updateRow('p', {}), (e) => e === 'text');
  });

  it('builds its own client from a token without calling Notion', () => {
    assert.doesNotThrow(() => new SdkNotionGateway('placeholder-token'));
  });
});

describe('loadEnvLocal', () => {
  it('ignores a missing file and rethrows other errors', () => {
    const missing = () => { throw Object.assign(new Error('nope'), { code: 'ENOENT' }); };
    assert.equal(loadEnvLocal('.env.local', missing), false);
    const broken = () => { throw Object.assign(new Error('perm'), { code: 'EACCES' }); };
    assert.throws(() => loadEnvLocal('.env.local', broken), /perm/);
  });

  it('loads variables from a file and does not override existing ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fc-env-'));
    const file = join(dir, '.env.local');
    writeFileSync(file, 'FC_TEST_ENV_NEW=from-file\nFC_TEST_ENV_KEEP=from-file\n');
    process.env.FC_TEST_ENV_KEEP = 'from-shell';
    try {
      assert.equal(loadEnvLocal(file), true);
      assert.equal(process.env.FC_TEST_ENV_NEW, 'from-file');
      assert.equal(process.env.FC_TEST_ENV_KEEP, 'from-shell');
    } finally {
      delete process.env.FC_TEST_ENV_NEW;
      delete process.env.FC_TEST_ENV_KEEP;
      rmSync(dir, { recursive: true, force: true });
    }
    assert.match(DEFAULT_PARENT_PAGE_ID, /^[0-9a-f-]{36}$/);
  });
});
