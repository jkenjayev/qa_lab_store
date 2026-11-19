import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { toLocalIso } from './clock.js';
import { CATEGORIES, PRODUCTS } from './data/products.js';
import { PROMOS } from './data/promos.js';
import { InMemoryCartRepository, InMemoryOrderRepository, InMemoryProductRepository } from './data/repositories.js';
import { createDefects } from './defects.js';
import { MockPaymentGateway } from './domain/payment.js';
import { createFeatures } from './features.js';
import { cartRouter } from './routes/cart.js';
import { catalogRouter } from './routes/catalog.js';
import { checkoutRouter } from './routes/checkout.js';
import { errorHandler } from './routes/http.js';
import { CartService } from './services/CartService.js';
import { CatalogService } from './services/CatalogService.js';
import { CheckoutService } from './services/CheckoutService.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Composition root: builds the Express app from injected collaborators.
 * mode `on` = training build with seeded defects, `off` = reference build.
 */
export function createApp({ mode = 'on', clock, storage }) {
  const defects = createDefects(mode);
  const features = createFeatures(mode);

  // Notion storage (when given) supplies the catalog and the write-through repositories.
  const productRepo = new InMemoryProductRepository(storage?.products ?? PRODUCTS);
  const cartRepo = storage?.cartRepo ?? new InMemoryCartRepository(clock);
  const orderRepo = storage?.orderRepo ?? new InMemoryOrderRepository();
  const promos = storage?.promos ?? PROMOS;

  const catalogService = new CatalogService({ productRepo, categories: CATEGORIES, defects });
  const cartService = new CartService({ cartRepo, productRepo, defects, features, promos });
  const checkoutService = new CheckoutService({
    cartService,
    orderRepo,
    gateway: new MockPaymentGateway({ defects }),
    clock,
    defects,
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/api/config', (_req, res) =>
    res.json({ mode, defects, features, now: toLocalIso(clock.now()) }),
  );
  // Facilitator view of the Notion write queue (mode, pending writes, last error).
  app.get('/api/dev/storage', (_req, res) => res.json(storage?.status() ?? { mode: 'memory', pending: 0, lastError: null, lastSyncAt: null }));
  app.use(catalogRouter({ catalogService }));
  app.use(cartRouter({ cartService }));
  app.use(checkoutRouter({ checkoutService, catalogService, features }));

  app.use('/css', express.static(path.join(root, 'public/css')));
  app.use('/js', express.static(path.join(root, 'public/js')));
  app.use('/shared', express.static(path.join(root, 'src/shared')));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Topilmadi' }));
  // Single page app: every other path serves the shell and the browser router takes over.
  app.get('*', (_req, res) => res.sendFile(path.join(root, 'public/index.html')));

  app.use(errorHandler);
  app.locals.services = { catalogService, cartService, checkoutService };
  return app;
}
