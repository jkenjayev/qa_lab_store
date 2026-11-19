import { catalogEntities, openStores, resolveMode } from './bootstrap.js';
import { DEFAULT_PARENT_PAGE_ID } from './env.js';
import { SdkNotionGateway } from './SdkNotionGateway.js';
import { WriteQueue } from './WriteQueue.js';
import { rowProperties } from './rows.js';

function requireToken(env) {
  if (!env.NOTION_TOKEN) throw new Error('NOTION_TOKEN is not set. Put it in .env.local (see .env.example).');
}

/**
 * npm run notion:seed [-- --reset]
 * Writes products and promo codes (identical rows cause no call; extras are archived).
 * --reset also archives every cart and order row.
 */
export async function runSeed({ env = process.env, argv = [], gateway, queue, log = console.log } = {}) {
  requireToken(env);
  const notion = gateway ?? new SdkNotionGateway(env.NOTION_TOKEN);
  const writeQueue = queue ?? new WriteQueue();
  const stores = await openStores({
    gateway: notion,
    parentPageId: env.NOTION_PARENT_PAGE_ID || DEFAULT_PARENT_PAGE_ID,
    queue: writeQueue,
    warn: log,
  });
  const catalog = catalogEntities();
  await Promise.all(Object.values(stores).map((s) => s.load()));

  const result = {
    products: await stores.products.sync(catalog.products, { prune: true }),
    promos: await stores.promos.sync(catalog.promos, { prune: true }),
  };
  if (argv.includes('--reset')) {
    result.carts = await stores.carts.sync([], { prune: true });
    result.orders = await stores.orders.sync([], { prune: true });
  }
  await writeQueue.idle();
  const failure = writeQueue.status().lastError;
  if (failure) throw new Error(`Seed finished with an error on ${failure.key}: ${failure.message}`);
  log(`Seed done: ${JSON.stringify(result)}`);
  return result;
}

/** npm run notion:verify: create, read and archive one temporary row in FC Products. */
export async function runVerify({ env = process.env, gateway, log = console.log, now = Date.now } = {}) {
  requireToken(env);
  if (resolveMode(env) !== 'notion') throw new Error('STORAGE=memory: nothing to verify');
  const notion = gateway ?? new SdkNotionGateway(env.NOTION_TOKEN);
  const parent = env.NOTION_PARENT_PAGE_ID || DEFAULT_PARENT_PAGE_ID;
  const dataSourceId = await notion.resolveDataSource(parent, 'FC Products');
  const key = `__verify__${now()}`;
  const created = await notion.createRow(dataSourceId, rowProperties(key, 'verify row', { ok: true }));
  const found = (await notion.queryRows(dataSourceId)).some((r) => r.id === created.id);
  await notion.archiveRow(created.id);
  if (!found) throw new Error('Wrote a row but could not read it back from FC Products');
  log('OK: Notion read, write and archive work for FC Products');
  return true;
}
