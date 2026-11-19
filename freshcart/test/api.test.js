import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ConflictError, HttpError } from '../src/domain/errors.js';
import { errorHandler } from '../src/routes/http.js';
import { VALID_CARD, VALID_DELIVERY, startServer } from './helpers.js';

let on;
let off;
before(async () => {
  on = await startServer({ mode: 'on' });
  off = await startServer({ mode: 'off' });
});
after(async () => {
  await on.close();
  await off.close();
});

describe('config and static files', () => {
  it('reports the mode, 35 defects and the walkthrough clock', async () => {
    const training = await on.client().get('/api/config');
    assert.equal(training.body.mode, 'on');
    assert.equal(Object.keys(training.body.defects).length, 35);
    assert.ok(Object.values(training.body.defects).every(Boolean));
    assert.equal(training.body.now, '2026-11-19T15:00:00');
    assert.equal(training.body.features.notifyMe, false);
    const reference = await off.client().get('/api/config');
    assert.ok(Object.values(reference.body.defects).every((v) => v === false));
    assert.equal(reference.body.features.notifyMe, true);
  });

  it('serves the shell for browser routes and the static modules', async () => {
    const c = on.client();
    const page = await c.get('/products/12');
    assert.equal(page.status, 200);
    assert.match(page.body, /<main id="app"/);
    assert.match((await c.get('/js/rules.js')).body, /badgeCount/);
    assert.match((await c.get('/shared/validation.js')).body, /validateDelivery/);
    assert.match((await c.get('/css/app.css')).body, /--primary/);
  });

  it('answers unknown API paths with JSON 404 and bad JSON with 400', async () => {
    const c = on.client();
    assert.deepEqual((await c.get('/api/nope')).body, { error: 'Topilmadi' });
    const bad = await fetch(`${on.url}/api/cart/items`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
    assert.equal(bad.status, 400);
  });

  it('maps errors to JSON and hides unexpected ones', () => {
    const sent = {};
    const res = { status(code) { sent.status = code; return this; }, json(body) { sent.body = body; return this; } };
    errorHandler(new ConflictError('x'), {}, res);
    assert.deepEqual(sent, { status: 409, body: { error: 'x' } });
    errorHandler(new HttpError(418, 'teapot', { extra: 1 }), {}, res);
    assert.deepEqual(sent, { status: 418, body: { error: 'teapot', extra: 1 } });
    const original = console.error;
    console.error = () => {};
    errorHandler(new Error('secret detail'), {}, res);
    console.error = original;
    assert.deepEqual(sent, { status: 500, body: { error: 'Kutilmagan server xatosi' } });
  });
});

describe('catalog API', () => {
  it('FC_PAGE_SIZE_10: 10 per page in the training build, 12 in the reference build', async () => {
    assert.equal((await on.client().get('/api/products')).body.items.length, 10);
    assert.equal((await off.client().get('/api/products')).body.items.length, 12);
  });

  it('FC_PRICE_MIN_GT_MAX_NO_ERROR: 200 and empty vs 400 with the message', async () => {
    const training = await on.client().get('/api/products?min=12&max=5');
    assert.equal(training.status, 200);
    assert.equal(training.body.total, 0);
    const reference = await off.client().get('/api/products?min=12&max=5');
    assert.equal(reference.status, 400);
    assert.equal(reference.body.error, 'Minimal narx maksimal narxdan oshmasligi kerak');
  });

  it('returns product details, a JSON 404 for an unknown id and the categories', async () => {
    const c = on.client();
    const product = await c.get('/api/products/12');
    assert.equal(product.body.name, 'Sut, to\'liq yog\'li 1 l');
    assert.equal(product.body.imageCount, 4);
    const missing = await c.get('/api/products/99999');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, 'Mahsulot topilmadi');
    assert.equal((await c.get('/api/categories')).body.length, 8);
  });

  it('suggests and searches', async () => {
    assert.equal((await on.client().get('/api/suggest?q=a')).body.length, 5);
    assert.deepEqual((await off.client().get('/api/suggest?q=a')).body, []);
    assert.equal((await on.client().get('/api/products?q=sut')).body.total, 0);
    assert.equal((await off.client().get('/api/products?q=sut')).body.total, 4);
  });

  it('serves product pictures as SVG', async () => {
    const c = on.client();
    const img = await c.get('/img/12/3.svg');
    assert.equal(img.status, 200);
    assert.match(img.type, /svg/);
    assert.match(img.body, /rasm 3/);
    assert.equal((await c.get('/img/99999/1.svg')).status, 404);
  });
});

describe('cart API', () => {
  it('FC_CART_DUPLICATE_LINE and FC_OOS_ADD_ENABLED: training build vs reference build', async () => {
    const t = on.client();
    await t.post('/api/cart/items', { productId: 12, quantity: 1 });
    const twice = await t.post('/api/cart/items', { productId: 12, quantity: 1 });
    assert.equal(twice.body.lines.length, 2);

    const r = off.client();
    const refused = await r.post('/api/cart/items', { productId: 12 });
    assert.equal(refused.status, 409);
    await r.post('/api/cart/items', { productId: 19 });
    const merged = await r.post('/api/cart/items', { productId: 19 });
    assert.equal(merged.body.lines.length, 1);
    assert.equal(merged.body.lines[0].quantity, 2);
  });

  it('keeps the cart by the X-Cart-Id header and starts a new cart for an unknown id', async () => {
    const a = on.client();
    const added = await a.post('/api/cart/items', { productId: 19, quantity: 3 });
    const b = on.client();
    b.cartId = added.body.cartId;
    assert.equal((await b.get('/api/cart')).body.lines[0].quantity, 3);
    const c = on.client();
    c.cartId = 'unknown';
    const fresh = await c.get('/api/cart');
    assert.deepEqual(fresh.body.lines, []);
    assert.notEqual(fresh.body.cartId, 'unknown');
  });

  it('changes quantity, removes a line, applies and removes a promo and clears', async () => {
    const c = off.client();
    const added = await c.post('/api/cart/items', { productId: 14, quantity: 3 });
    const lineId = added.body.lines[0].lineId;
    assert.equal((await c.patch(`/api/cart/lines/${lineId}`, { quantity: 4 })).body.totals.subtotalCents, 5600);
    assert.equal((await c.patch(`/api/cart/lines/${lineId}`, { quantity: 0 })).status, 400);
    assert.equal((await c.patch('/api/cart/lines/nope', { quantity: 2 })).status, 404);
    const promo = await c.post('/api/cart/promo', { code: 'save5' });
    assert.equal(promo.body.promoMessage, 'Promokod qo\'llandi: SAVE5');
    assert.equal((await c.post('/api/cart/promo', { code: 'SUMMER20' })).body.error, 'Promokod muddati tugagan');
    assert.equal((await c.del('/api/cart/promo')).body.promoCodes.length, 0);
    assert.deepEqual((await c.del(`/api/cart/lines/${lineId}`)).body.lines, []);
    await c.post('/api/cart/items', { productId: 14 });
    assert.deepEqual((await c.post('/api/cart/clear')).body.lines, []);
  });
});

describe('checkout API', () => {
  async function readyCart(server) {
    const c = server.client();
    await c.post('/api/cart/items', { productId: 19, quantity: 2 });
    const slot = await c.post('/api/checkout/delivery', { ...VALID_DELIVERY, slotId: '2026-11-20T12' });
    assert.equal(slot.status, 200);
    return c;
  }

  it('lists the slots and refuses an empty cart or bad fields', async () => {
    const c = off.client();
    assert.equal((await c.get('/api/delivery/slots')).body.days.length, 3);
    assert.equal((await c.post('/api/checkout/delivery', { ...VALID_DELIVERY, slotId: '2026-11-20T12' })).status, 409);
    await c.post('/api/cart/items', { productId: 19 });
    const bad = await c.post('/api/checkout/delivery', { ...VALID_DELIVERY, zip: '1', slotId: '2026-11-20T12' });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.fieldErrors.zip, '5 xonali pochta indeksini kiriting');
  });

  it('places an order, shows it and lists it in the mock order list', async () => {
    const c = await readyCart(on);
    const paid = await c.post('/api/checkout/pay', VALID_CARD);
    assert.equal(paid.status, 201);
    assert.match(paid.body.number, /^FC-\d{6}$/);
    const fetched = await c.get(`/api/orders/${paid.body.number}`);
    assert.equal(fetched.body.delivery.slotLabel, 'Ju 20 Noy, 12:00-14:00');
    assert.ok((await c.get('/api/dev/orders')).body.some((o) => o.number === paid.body.number));
    assert.equal((await c.get('/api/orders/FC-1')).status, 404);
  });

  it('FC_DOUBLE_SUBMIT_TWO_ORDERS: two concurrent payments create two orders in the training build', async () => {
    const c = await readyCart(on);
    const [a, b] = await Promise.all([c.post('/api/checkout/pay', VALID_CARD), c.post('/api/checkout/pay', VALID_CARD)]);
    assert.deepEqual([a.status, b.status], [201, 201]);
    assert.notEqual(a.body.number, b.body.number);
  });

  it('FC_DOUBLE_SUBMIT_TWO_ORDERS: the reference build refuses the second payment', async () => {
    const c = await readyCart(off);
    const [a, b] = await Promise.all([c.post('/api/checkout/pay', VALID_CARD), c.post('/api/checkout/pay', VALID_CARD)]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  });

  it('FC_DECLINE_SHOWS_CONFIRMATION: the decline card is 402 in the reference build', async () => {
    const c = await readyCart(off);
    const declined = await c.post('/api/checkout/pay', { ...VALID_CARD, number: '4000 0000 0000 0002' });
    assert.equal(declined.status, 402);
    assert.equal(declined.body.error, 'To\'lov rad etildi. Boshqa kartani sinab ko\'ring.');
    const invalid = await c.post('/api/checkout/pay', { ...VALID_CARD, cvc: '' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.fieldErrors.cvc, '3 yoki 4 xonali CVC kodini kiriting');
  });

  it('Notify me exists only in the reference build', async () => {
    assert.equal((await on.client().post('/api/notify-me', { email: 'a@b.co', productId: 12 })).status, 404);
    const c = off.client();
    assert.equal((await c.post('/api/notify-me', { email: 'a@b.co', productId: 12 })).status, 201);
    const bad = await c.post('/api/notify-me', { email: 'nope', productId: 12 });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, 'To\'g\'ri email manzilini kiriting');
    assert.equal((await c.post('/api/notify-me', { email: 'a@b.co', productId: 9999 })).status, 404);
  });
});
