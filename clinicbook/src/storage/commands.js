import { ConfigError } from '../domain/errors.js';
import { createSeed } from '../data/seed.js';
import { SHARED_HASH_SENTINEL, snapshotFromSeed } from './collections.js';
import { collectionsFor } from './createStorage.js';
import { NotionStore } from './NotionStore.js';
import { SdkNotionGateway } from './SdkNotionGateway.js';
import { DEFAULT_PARENT_PAGE_ID } from './settings.js';
import { WriteQueue } from './WriteQueue.js';

function requireToken(env) {
  if (!env.NOTION_TOKEN) throw new ConfigError('NOTION_TOKEN is not set. Put it in .env.local (see .env.example).');
  return env.NOTION_TOKEN;
}

/**
 * npm run notion:seed. Writes the seed data into the six databases. Safe to run again: rows that
 * already match are skipped, changed rows are restored, rows that are not in the seed are kept.
 */
export async function runSeed({ env, log = console.warn, gatewayFactory, queue } = {}) {
  const token = requireToken(env);
  const store = new NotionStore({
    gateway: gatewayFactory ? gatewayFactory(token) : new SdkNotionGateway(token),
    queue: queue ?? new WriteQueue(),
    collections: collectionsFor(null),
    parentPageId: env.NOTION_PARENT_PAGE_ID || DEFAULT_PARENT_PAGE_ID,
    ctx: { sharedHash: SHARED_HASH_SENTINEL },
    log,
  });
  await store.loadAll();
  const seed = createSeed({ passwordHash: SHARED_HASH_SENTINEL });
  const results = await store.replaceAll(snapshotFromSeed(seed), { archiveExtras: false });
  const failed = results.filter((ok) => !ok).length;
  log(`Seed finished: ${results.length - failed} rows in place, ${failed} failed.`);
  if (failed > 0) throw new Error(`${failed} rows could not be written; see the lines above.`);
  return { written: results.length };
}

/** npm run notion:verify. Creates, reads and archives one temporary row to prove the token and the databases work. */
export async function runVerify({ env, log = console.warn, gatewayFactory } = {}) {
  const token = requireToken(env);
  const gateway = gatewayFactory ? gatewayFactory(token) : new SdkNotionGateway(token);
  const parent = env.NOTION_PARENT_PAGE_ID || DEFAULT_PARENT_PAGE_ID;
  const sources = await gateway.resolveCollections(parent, ['CB Doctors']);
  const dataSourceId = sources['CB Doctors'];
  const key = `__verify__${Date.now()}`;
  const pageId = await gateway.createRow(dataSourceId, { key, summary: 'temporary check row', data: '{"verify":true}' });
  const rows = await gateway.listRows(dataSourceId);
  const found = rows.some((row) => row.pageId === pageId && row.data === '{"verify":true}');
  await gateway.archiveRow(pageId);
  if (!found) throw new Error('The temporary row was written but could not be read back.');
  log('OK: Notion token works, databases found, a row was written, read back and archived.');
  return { ok: true };
}
