import { createApp } from '../src/app.js';
import { createClock } from '../src/clock.js';
import { InMemoryCartRepository, InMemoryOrderRepository, InMemoryProductRepository } from '../src/data/repositories.js';
import { CATEGORIES, PRODUCTS } from '../src/data/products.js';
import { createDefects } from '../src/defects.js';
import { MockPaymentGateway } from '../src/domain/payment.js';
import { createFeatures } from '../src/features.js';
import { CartService } from '../src/services/CartService.js';
import { CatalogService } from '../src/services/CatalogService.js';
import { CheckoutService } from '../src/services/CheckoutService.js';

/** Defects on = training build, off = reference build. */
export const ON = createDefects('on');
export const OFF = createDefects('off');
/** Features: PARTIAL = training build (some pieces not built), COMPLETE = reference build. */
export const PARTIAL = createFeatures('on');
export const COMPLETE = createFeatures('off');

export const VALID_DELIVERY = {
  fullName: 'Amina Test',
  phone: '5550101234',
  street: '1 Test Street',
  city: 'Springfield',
  zip: '12345',
};
export const VALID_CARD = { number: '4242 4242 4242 4242', expiry: '12/29', cvc: '123', name: 'Amina Test' };

/** Services wired like the app, with a clock the test can move. */
export function makeServices(mode = 'on', startIso = '2026-11-19T15:00:00') {
  let time = new Date(startIso).getTime();
  const clock = { now: () => new Date(time), advance: (ms) => { time += ms; } };
  const defects = createDefects(mode);
  const features = createFeatures(mode);
  const productRepo = new InMemoryProductRepository(PRODUCTS);
  const cartRepo = new InMemoryCartRepository(clock);
  const orderRepo = new InMemoryOrderRepository();
  const cartService = new CartService({ cartRepo, productRepo, defects, features });
  const catalogService = new CatalogService({ productRepo, categories: CATEGORIES, defects });
  const checkoutService = new CheckoutService({
    cartService,
    orderRepo,
    gateway: new MockPaymentGateway({ defects }),
    clock,
    defects,
  });
  return { clock, defects, features, productRepo, cartRepo, orderRepo, cartService, catalogService, checkoutService };
}

/** Start the real Express app on an ephemeral port and return a small JSON client. */
export async function startServer({ mode = 'on', env = {}, storage, clock } = {}) {
  const app = createApp({ mode, clock: clock ?? createClock(env), storage });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const url = `http://localhost:${server.address().port}`;

  function client() {
    let cartId = null;
    async function call(method, path, body, headers = {}) {
      const h = { 'content-type': 'application/json', ...headers };
      if (cartId) h['x-cart-id'] = cartId;
      const res = await fetch(url + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
      const type = res.headers.get('content-type') ?? '';
      const data = type.includes('json') ? await res.json() : await res.text();
      if (data && typeof data === 'object' && data.cartId) cartId = data.cartId;
      return { status: res.status, body: data, type };
    }
    return {
      call,
      get: (p) => call('GET', p),
      post: (p, b) => call('POST', p, b),
      patch: (p, b) => call('PATCH', p, b),
      del: (p) => call('DELETE', p),
      get cartId() {
        return cartId;
      },
      set cartId(v) {
        cartId = v;
      },
    };
  }

  return { url, client, close: () => new Promise((resolve) => server.close(resolve)) };
}
