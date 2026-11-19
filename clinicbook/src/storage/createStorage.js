import { ConfigError } from '../domain/errors.js';
import { hashPassword, verifyPassword } from '../domain/password.js';
import { SHARED_HASH_SENTINEL, createCollections, seedFromSnapshot } from './collections.js';
import { NotionStore } from './NotionStore.js';
import { SdkNotionGateway } from './SdkNotionGateway.js';
import { DEFAULT_PARENT_PAGE_ID } from './settings.js';
import { NOOP_SINK } from './sink.js';
import { WriteQueue } from './WriteQueue.js';

/** Storage used by tests and quick local runs: everything stays in memory. */
export function createMemoryStorage() {
  return {
    mode: 'memory',
    initialData: null,
    sink: NOOP_SINK,
    status: () => ({ mode: 'memory', pending: 0, lastError: null, lastSyncAt: null }),
    flush: async () => {},
  };
}

/** Builds the collections with the hash rule for this run (shared training password). */
export function collectionsFor(trainingPassword) {
  return createCollections({
    isSharedHash: (hash) => hash === SHARED_HASH_SENTINEL || Boolean(trainingPassword && hash && verifyPassword(trainingPassword, hash)),
  });
}

/**
 * Chooses and starts the storage. STORAGE=notion|memory; default is notion when NOTION_TOKEN is set.
 * With notion, the rows are loaded now; the app starts from them. The token is never logged.
 */
export async function createStorage({ env, trainingPassword, log = console.warn, gatewayFactory, queue } = {}) {
  const explicit = env.STORAGE ? String(env.STORAGE).toLowerCase() : undefined;
  const mode = explicit ?? (env.NOTION_TOKEN ? 'notion' : 'memory');
  if (mode !== 'notion' && mode !== 'memory') throw new ConfigError(`STORAGE must be notion or memory, got "${env.STORAGE}"`);

  if (mode === 'memory') {
    if (!explicit) log('WARNING: no NOTION_TOKEN, so data is kept in memory only and NOT stored in Notion. Put NOTION_TOKEN in .env.local (see .env.example).');
    return createMemoryStorage();
  }
  if (!env.NOTION_TOKEN) {
    throw new ConfigError('STORAGE=notion needs NOTION_TOKEN. Put it in .env.local (see .env.example) or start with STORAGE=memory.');
  }

  const gateway = gatewayFactory ? gatewayFactory(env.NOTION_TOKEN) : new SdkNotionGateway(env.NOTION_TOKEN);
  const store = new NotionStore({
    gateway,
    queue: queue ?? new WriteQueue(),
    collections: collectionsFor(trainingPassword),
    parentPageId: env.NOTION_PARENT_PAGE_ID || DEFAULT_PARENT_PAGE_ID,
    ctx: { sharedHash: hashPassword(trainingPassword) },
    log,
  });
  const snapshot = await store.loadAll();
  const empty = ['doctors', 'schedules', 'staff'].filter((name) => snapshot[name].length === 0);
  if (empty.length > 0) {
    throw new ConfigError(`The Notion databases for ${empty.join(', ')} are empty. Run: npm run notion:seed`);
  }
  log(`Notion storage ready: ${Object.entries(snapshot).map(([name, rows]) => `${name} ${rows.length}`).join(', ')}`);
  return {
    mode: 'notion',
    initialData: seedFromSnapshot(snapshot),
    sink: {
      upsert: (name, entity) => void store.upsert(name, entity),
      remove: (name, key) => void store.remove(name, key),
      replaceAll: (data) => void store.replaceAll(data),
    },
    status: () => store.status(),
    flush: () => store.flush(),
  };
}
