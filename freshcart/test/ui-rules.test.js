import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError, createApi } from '../public/js/api.js';
import { CART_KEY, createCartSession, pickStorage } from '../public/js/cartSession.js';
import { formatCardPrice, formatCountdown, formatPrice } from '../public/js/format.js';
import { esc } from '../public/js/html.js';
import { buildUrl, matchRoute, parseQuery } from '../public/js/routes.js';
import * as rules from '../public/js/rules.js';
import { OFF, ON } from './helpers.js';

describe('F1.1 price format', () => {
  it('formats prices with 2 decimals', () => {
    assert.equal(formatPrice(120), '$1.20');
    assert.equal(formatPrice(-400), '-$4.00');
  });

  it('FC_PRICE_ONE_DECIMAL on: card prices show 1 decimal', () => {
    assert.deepEqual([120, 350, 200, 450, 80].map((c) => formatCardPrice(c, ON)), ['$1.2', '$3.5', '$2.0', '$4.5', '$0.8']);
  });

  it('FC_PRICE_ONE_DECIMAL off: card prices show 2 decimals', () => {
    assert.deepEqual([120, 350, 200, 450, 80].map((c) => formatCardPrice(c, OFF)), ['$1.20', '$3.50', '$2.00', '$4.50', '$0.80']);
  });

  it('formats the hold countdown', () => {
    assert.equal(formatCountdown(600), '10:00');
    assert.equal(formatCountdown(581), '09:41');
    assert.equal(formatCountdown(-5), '00:00');
  });
});

describe('browser rules, training build (defects on)', () => {
  it('FC_BADGE_COUNTS_LINES: the badge counts lines', () => {
    assert.equal(rules.badgeCount([{ quantity: 3 }], ON), 1);
  });
  it('FC_STEPPER_MAX_11: stepper goes to 11', () => assert.equal(rules.stepperMax(ON), 11));
  it('FC_TOAST_ONE_SECOND: toast lasts 1 second', () => assert.equal(rules.toastMs(ON), 1000));
  it('FC_SUGGEST_ONE_CHAR: suggestions after 1 character', () => assert.equal(rules.suggestMinChars(ON), 1));
  it('FC_SEARCH_NO_MAXLENGTH: no maxlength on the search input', () => assert.equal(rules.searchMaxLength(ON), null));
  it('FC_CATEGORY_URL_NOT_UPDATED: category does not change the URL', () => assert.equal(rules.shouldPushCategoryUrl(ON), false));
  it('FC_CART_NOT_PERSISTED_ACROSS_TABS: the cart id lives in session storage', () => assert.equal(rules.cartStorageKind(ON), 'session'));
  it('FC_DETAIL_THREE_IMAGES: 3 of 4 thumbnails', () => assert.equal(rules.thumbnailCount(4, ON), 3));
  it('FC_DETAIL_404_BLANK: no Mahsulot topilmadi page', () => assert.equal(rules.showProductNotFoundPage(ON), false));
  it('FC_EMPTY_CART_BLANK: no empty cart message', () => assert.equal(rules.showEmptyCartMessage(ON), false));
  it('FC_LOW_STOCK_AT_6: stock 6 is low stock', () => assert.deepEqual(rules.stockState(6, ON), { kind: 'low', text: 'Atigi 6 ta qoldi' }));
  it('FC_OOS_ADD_ENABLED: Add to cart stays on out-of-stock products', () => {
    assert.equal(rules.cardAction(0, ON), 'add');
    assert.deepEqual(rules.detailActions(0, ON), { add: true, notify: true });
  });
});

describe('browser rules, reference build (defects off)', () => {
  it('FC_BADGE_COUNTS_LINES: the badge counts units', () => {
    assert.equal(rules.badgeCount([{ quantity: 3 }, { quantity: 2 }], OFF), 5);
    assert.equal(rules.badgeCount([], OFF), 0);
  });
  it('FC_STEPPER_MAX_11: stepper stops at 10', () => assert.equal(rules.stepperMax(OFF), 10));
  it('FC_TOAST_ONE_SECOND: toast lasts 4 seconds', () => assert.equal(rules.toastMs(OFF), 4000));
  it('FC_SUGGEST_ONE_CHAR: suggestions after 2 characters', () => assert.equal(rules.suggestMinChars(OFF), 2));
  it('FC_SEARCH_NO_MAXLENGTH: the search input is limited to 50', () => assert.equal(rules.searchMaxLength(OFF), 50));
  it('FC_CATEGORY_URL_NOT_UPDATED: category changes the URL', () => assert.equal(rules.shouldPushCategoryUrl(OFF), true));
  it('FC_CART_NOT_PERSISTED_ACROSS_TABS: the cart id lives in local storage', () => assert.equal(rules.cartStorageKind(OFF), 'local'));
  it('FC_DETAIL_THREE_IMAGES: all 4 thumbnails', () => {
    assert.equal(rules.thumbnailCount(4, OFF), 4);
    assert.equal(rules.thumbnailCount(2, ON), 2);
  });
  it('FC_DETAIL_404_BLANK: Mahsulot topilmadi page is shown', () => assert.equal(rules.showProductNotFoundPage(OFF), true));
  it('FC_EMPTY_CART_BLANK: the empty cart message is shown', () => assert.equal(rules.showEmptyCartMessage(OFF), true));
  it('FC_LOW_STOCK_AT_6: stock 6 is plain in stock, 5 is low, 0 is out', () => {
    assert.deepEqual(rules.stockState(6, OFF), { kind: 'in', text: 'Sotuvda bor' });
    assert.deepEqual(rules.stockState(5, OFF), { kind: 'low', text: 'Atigi 5 ta qoldi' });
    assert.deepEqual(rules.stockState(0, OFF), { kind: 'out', text: "Sotuvda yo\'q" });
    assert.deepEqual(rules.stockState(7, ON), { kind: 'in', text: 'Sotuvda bor' });
  });
  it('FC_OOS_ADD_ENABLED: out-of-stock products only offer Notify me', () => {
    assert.equal(rules.cardAction(0, OFF), 'notify');
    assert.equal(rules.cardAction(5, OFF), 'add');
    assert.deepEqual(rules.detailActions(0, OFF), { add: false, notify: true });
    assert.deepEqual(rules.detailActions(5, OFF), { add: true, notify: false });
  });
});

describe('cart session', () => {
  const memory = () => {
    const map = new Map();
    return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
  };

  it('picks local or session storage by build', () => {
    const local = memory();
    const session = memory();
    assert.equal(pickStorage(OFF, { local, session }), local);
    assert.equal(pickStorage(ON, { local, session }), session);
  });

  it('stores, reads and clears the cart id', () => {
    const storage = memory();
    const s = createCartSession(storage);
    assert.equal(s.get(), null);
    s.set('abc');
    assert.equal(storage.getItem(CART_KEY), 'abc');
    assert.equal(s.get(), 'abc');
    s.clear();
    assert.equal(s.get(), null);
  });

  it('survives a blocked storage', () => {
    const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
    const s = createCartSession(blocked);
    s.set('abc');
    s.clear();
    assert.equal(s.get(), null);
  });
});

describe('routes and html helpers', () => {
  it('matches browser routes', () => {
    assert.deepEqual(matchRoute('/'), { name: 'home', params: {} });
    assert.equal(matchRoute('/products').name, 'products');
    assert.equal(matchRoute('/products/').name, 'products');
    assert.deepEqual(matchRoute('/products/12'), { name: 'product', params: { id: '12' } });
    assert.equal(matchRoute('/search').name, 'search');
    assert.equal(matchRoute('/cart').name, 'cart');
    assert.equal(matchRoute('/checkout/delivery').name, 'delivery');
    assert.equal(matchRoute('/checkout/payment').name, 'payment');
    assert.equal(matchRoute('/order/confirmation').name, 'confirmation');
    assert.equal(matchRoute('/dev/orders').name, 'devOrders');
    assert.equal(matchRoute('/nothing/here').name, 'notFound');
  });

  it('parses and builds query strings', () => {
    assert.deepEqual(parseQuery('?q=milk&page=2'), { q: 'milk', page: '2' });
    assert.equal(buildUrl('/products', { page: 2, sort: '', category: undefined, min: null }), '/products?page=2');
    assert.equal(buildUrl('/products'), '/products');
  });

  it('escapes HTML', () => {
    assert.equal(esc(`<b a="1">&'`), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;');
  });
});

describe('api client', () => {
  function fakeFetch(responder) {
    const calls = [];
    const fetchFn = async (path, init) => {
      calls.push({ path, init });
      const { status = 200, body = {} } = responder(path, init);
      return { ok: status < 400, status, json: async () => body };
    };
    return { fetchFn, calls };
  }
  const session = () => {
    let id = null;
    return { get: () => id, set: (v) => { id = v; }, clear: () => { id = null; } };
  };

  it('sends the cart id header and remembers the cart id of responses', async () => {
    const { fetchFn, calls } = fakeFetch(() => ({ body: { cartId: 'c1', lines: [] } }));
    const cartSession = session();
    const api = createApi({ fetchFn, cartSession });
    await api.cart();
    assert.equal(calls[0].init.headers['X-Cart-Id'], undefined);
    assert.equal(cartSession.get(), 'c1');
    await api.cart();
    assert.equal(calls[1].init.headers['X-Cart-Id'], 'c1');
  });

  it('calls every endpoint with the right method and path', async () => {
    const { fetchFn, calls } = fakeFetch(() => ({ body: {} }));
    const api = createApi({ fetchFn, cartSession: session() });
    await api.config();
    await api.categories();
    await api.products({ page: 2, q: 'milk' });
    await api.product(12);
    await api.suggest('mil');
    await api.addItem(19, 3);
    await api.setQuantity('L1', 2);
    await api.removeLine('L1');
    await api.applyPromo('SAVE5');
    await api.removePromo();
    await api.clearCart();
    await api.slots();
    await api.setDelivery({ zip: '1' });
    await api.pay({ number: '1' });
    await api.order('FC-1');
    await api.devOrders();
    await api.notifyMe('a@b.co', 12);
    assert.deepEqual(
      calls.map((c) => `${c.init.method} ${c.path}`),
      [
        'GET /api/config',
        'GET /api/categories',
        'GET /api/products?page=2&q=milk',
        'GET /api/products/12',
        'GET /api/suggest?q=mil',
        'POST /api/cart/items',
        'PATCH /api/cart/lines/L1',
        'DELETE /api/cart/lines/L1',
        'POST /api/cart/promo',
        'DELETE /api/cart/promo',
        'POST /api/cart/clear',
        'GET /api/delivery/slots',
        'POST /api/checkout/delivery',
        'POST /api/checkout/pay',
        'GET /api/orders/FC-1',
        'GET /api/dev/orders',
        'POST /api/notify-me',
      ],
    );
    assert.deepEqual(JSON.parse(calls[5].init.body), { productId: 19, quantity: 3 });
  });

  it('turns an error response into an ApiError with the server message', async () => {
    const { fetchFn } = fakeFetch(() => ({ status: 400, body: { error: 'Minimal narx maksimal narxdan oshmasligi kerak' } }));
    const api = createApi({ fetchFn, cartSession: session() });
    await assert.rejects(api.products({}), (e) => e instanceof ApiError && e.status === 400 && e.message === 'Minimal narx maksimal narxdan oshmasligi kerak');
  });

  it('uses a generic message when the body is not JSON', async () => {
    const fetchFn = async () => ({ ok: false, status: 500, json: async () => { throw new Error('no json'); } });
    const api = createApi({ fetchFn, cartSession: session() });
    await assert.rejects(api.cart(), (e) => e.message === 'So\'rov bajarilmadi' && e.status === 500);
  });
});
