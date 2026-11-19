import { PROMOS } from '../data/promos.js';
import { PRODUCTS } from '../data/products.js';
import { DEFAULT_PARENT_PAGE_ID } from './env.js';
import { NotionEntityStore } from './NotionEntityStore.js';
import { PersistentCartRepository, PersistentOrderRepository } from './PersistentRepositories.js';
import { DB_TITLES, productRecord, promoRecord } from './records.js';
import { SdkNotionGateway } from './SdkNotionGateway.js';
import { WriteQueue } from './WriteQueue.js';

/** Memory mode: nothing is written anywhere. */
export function memoryStorage() {
  return { mode: 'memory', status: () => ({ mode: 'memory', pending: 0, lastError: null, lastSyncAt: null }) };
}

/** Choose the storage mode from env: notion when a token is set, else memory with a warning. */
export function resolveMode(env, warn = () => {}) {
  const asked = String(env.STORAGE ?? '').toLowerCase();
  if (asked && !['notion', 'memory'].includes(asked)) throw new Error(`STORAGE must be "notion" or "memory", got "${env.STORAGE}"`);
  if (asked === 'memory') return 'memory';
  if (env.NOTION_TOKEN) return 'notion';
  if (asked === 'notion') throw new Error('STORAGE=notion needs NOTION_TOKEN (put it in .env.local)');
  warn('NOTION_TOKEN is not set: running in memory mode, data is lost on restart. See README, "Notion storage".');
  return 'memory';
}

/** Resolve the four stores (database discovery by title on the parent page). */
export async function openStores({ gateway, parentPageId, queue, warn }) {
  const stores = {};
  for (const [name, title] of Object.entries(DB_TITLES)) {
    const dataSourceId = await gateway.resolveDataSource(parentPageId, title);
    stores[name] = new NotionEntityStore({ gateway, queue, dataSourceId, title, warn });
  }
  return stores;
}

/** Catalog rows (products and promos) the seed script writes. */
export const catalogEntities = () => ({
  products: PRODUCTS.map(productRecord),
  promos: Object.entries(PROMOS).map(([code, promo]) => promoRecord(code, promo)),
});

/**
 * Build the storage the app runs on. Notion mode loads catalog, carts and orders into memory
 * (write-through cache); every later change is queued to Notion.
 */
export async function createStorage({ env = process.env, clock, gateway, queue, warn = console.warn, log = () => {} } = {}) {
  const mode = resolveMode(env, warn);
  if (mode === 'memory') return memoryStorage();

  const writeQueue = queue ?? new WriteQueue();
  const notion = gateway ?? new SdkNotionGateway(env.NOTION_TOKEN);
  const parentPageId = env.NOTION_PARENT_PAGE_ID || DEFAULT_PARENT_PAGE_ID;
  const stores = await openStores({ gateway: notion, parentPageId, queue: writeQueue, warn });

  const products = (await stores.products.load()).map((r) => Object.freeze(r.data)).sort((a, b) => a.id - b.id);
  if (!products.length) {
    throw new Error('FC Products is empty. Run "npm run notion:seed" once to fill the databases.');
  }
  const promoRows = await stores.promos.load();
  const promos = Object.freeze(
    Object.fromEntries(
      promoRows.map(({ data: { code, ...rest } }) => [code, Object.freeze(rest)]),
    ),
  );

  const cartRepo = new PersistentCartRepository(clock, stores.carts);
  cartRepo.hydrate((await stores.carts.load()).map((r) => r.data));
  const orderRepo = new PersistentOrderRepository(stores.orders);
  orderRepo.hydrate((await stores.orders.load()).map((r) => r.data));
  log(`Notion storage ready: ${products.length} products, ${promoRows.length} promo codes, ${cartRepo.carts.size} carts, ${orderRepo.orders.length} orders`);

  return {
    mode: 'notion',
    products,
    promos,
    cartRepo,
    orderRepo,
    queue: writeQueue,
    status: () => ({ mode: 'notion', ...writeQueue.status() }),
  };
}
