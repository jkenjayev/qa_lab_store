import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toLocalIso } from '../src/clock.js';
import { slotIsOpen } from '../src/domain/delivery.js';
import { ConflictError, NotFoundError, PaymentDeclinedError, ValidationError } from '../src/domain/errors.js';
import { VALID_CARD, VALID_DELIVERY, makeServices } from './helpers.js';

const FRI_12 = '2026-11-20T12';
const FRI_10 = '2026-11-20T10';

describe('CatalogService', () => {
  it('lists, finds details, suggests and counts categories', () => {
    const { catalogService } = makeServices('off');
    assert.equal(catalogService.list({}).items.length, 12);
    assert.equal(catalogService.details('12').name, 'Sut, to\'liq yog\'li 1 l');
    assert.throws(() => catalogService.details('9999'), NotFoundError);
    const mil = catalogService.suggest('Sut').map((s) => s.name);
    assert.equal(mil.length, 4); // the 4 Sut products
    assert.ok(mil.includes('Sut, to\'liq yog\'li 1 l'));
    assert.equal(catalogService.categoryList().find((c) => c.slug === 'dairy').count, 9);
  });
});

describe('CartService', () => {
  it('FC_OOS_ADD_ENABLED on: an out-of-stock product can be added', () => {
    const { cartService } = makeServices('on');
    const view = cartService.addItem(null, 12, 1);
    assert.equal(view.lines[0].name, 'Sut, to\'liq yog\'li 1 l');
  });

  it('FC_OOS_ADD_ENABLED off: an out-of-stock product is refused', () => {
    const { cartService } = makeServices('off');
    assert.throws(() => cartService.addItem(null, 12, 1), (e) => e instanceof ConflictError && e.message === 'Bu mahsulot sotuvda yo\'q');
  });

  it('rejects unknown products and bad quantities', () => {
    const { cartService } = makeServices('off');
    assert.throws(() => cartService.addItem(null, 9999, 1), NotFoundError);
    assert.throws(() => cartService.addItem(null, 19, 0), ValidationError);
  });

  it('builds the view with priced lines, totals and the promo message', () => {
    const { cartService } = makeServices('off');
    const first = cartService.addItem(null, 19, 3);
    assert.equal(first.lines[0].lineTotalCents, 600);
    assert.equal(first.limit, 99);
    const view = cartService.addItem(first.cartId, 14, 3);
    assert.equal(view.totals.subtotalCents, 4800);
    const promo = cartService.applyPromo(view.cartId, 'fresh10');
    assert.equal(promo.promoMessage, 'Promokod qo\'llandi: FRESH10');
    assert.equal(promo.totals.discountCents, 480);
    assert.equal(cartService.removePromo(view.cartId).promoMessage, '');
  });

  it('changes quantities and removes lines', () => {
    const { cartService } = makeServices('off');
    const added = cartService.addItem(null, 19, 2);
    const line = added.lines[0].lineId;
    assert.equal(cartService.setQuantity(added.cartId, line, 5).lines[0].quantity, 5);
    assert.equal(cartService.setQuantity(added.cartId, line, 500).limitReached, true);
    assert.throws(() => cartService.setQuantity(added.cartId, 'nope', 2), NotFoundError);
    assert.throws(() => cartService.remove(added.cartId, 'nope'), NotFoundError);
    assert.deepEqual(cartService.remove(added.cartId, line).lines, []);
  });

  it('clears the cart and stores delivery details', () => {
    const { cartService } = makeServices('off');
    const added = cartService.addItem(null, 19, 2);
    assert.equal(cartService.setDelivery(added.cartId, { zip: '12345' }).delivery.zip, '12345');
    const cleared = cartService.clear(added.cartId);
    assert.deepEqual([cleared.lines, cleared.delivery, cleared.promoCodes], [[], null, []]);
  });

  it('keeps a guest cart for 7 days and then starts a new one', () => {
    const { cartService, clock } = makeServices('off');
    const added = cartService.addItem(null, 19, 2);
    clock.advance(6 * 24 * 3600 * 1000);
    assert.equal(cartService.get(added.cartId).lines.length, 1);
    clock.advance(8 * 24 * 3600 * 1000);
    const fresh = cartService.get(added.cartId);
    assert.notEqual(fresh.cartId, added.cartId);
    assert.deepEqual(fresh.lines, []);
  });

  it('an unknown cart id gives a new empty cart', () => {
    const { cartService } = makeServices('off');
    const view = cartService.get('does-not-exist');
    assert.deepEqual(view.lines, []);
    assert.ok(view.cartId);
  });
});

describe('F2.4 delivery slots', () => {
  const slotOf = (days, id) => days.flatMap((d) => d.slots).find((s) => s.id === id);

  it('offers 3 days with six 2-hour slots and a full Friday 10:00-12:00', () => {
    const { checkoutService } = makeServices('on');
    const days = checkoutService.slots();
    assert.deepEqual(days.map((d) => d.label), ['Pa 19 Noy', 'Ju 20 Noy', 'Sh 21 Noy']);
    assert.deepEqual(days[1].slots.map((s) => s.label), ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00']);
    const full = slotOf(days, FRI_10);
    assert.equal(full.full, true);
    assert.equal(full.remaining, 0);
    assert.ok(days.flatMap((d) => d.slots).filter((s) => s.id !== FRI_10).every((s) => s.remaining >= 1));
  });

  it('FC_FULL_SLOT_SELECTABLE on: the full slot is labelled full but selectable', () => {
    const slot = slotOf(makeServices('on').checkoutService.slots(), FRI_10);
    assert.equal(slot.full, true);
    assert.equal(slot.selectable, true);
  });

  it('FC_FULL_SLOT_SELECTABLE off: the full slot is disabled', () => {
    assert.equal(slotOf(makeServices('off').checkoutService.slots(), FRI_10).selectable, false);
  });

  it('FC_SAME_DAY_CUTOFF_1H on: at 15:00 the 16:00 slot can still be chosen', () => {
    const days = makeServices('on').checkoutService.slots();
    assert.equal(slotOf(days, '2026-11-19T16').selectable, true);
    assert.equal(slotOf(days, '2026-11-19T14').selectable, false);
    assert.equal(slotOf(days, '2026-11-19T18').selectable, true);
  });

  it('FC_SAME_DAY_CUTOFF_1H off: at 15:00 the 16:00 slot is closed (2 hour cutoff)', () => {
    const days = makeServices('off').checkoutService.slots();
    assert.equal(slotOf(days, '2026-11-19T16').selectable, false);
    assert.equal(slotOf(days, '2026-11-19T18').selectable, true);
    assert.equal(slotOf(days, '2026-11-19T08').selectable, false);
  });

  it('slotIsOpen compares the start with the cutoff', () => {
    const now = new Date('2026-11-19T15:00:00');
    const at = (h) => new Date(`2026-11-19T${h}:00:00`);
    assert.equal(slotIsOpen(at('17'), now, { FC_SAME_DAY_CUTOFF_1H: false }), true);
    assert.equal(slotIsOpen(at('16'), now, { FC_SAME_DAY_CUTOFF_1H: false }), false);
    assert.equal(slotIsOpen(at('16'), now, { FC_SAME_DAY_CUTOFF_1H: true }), true);
  });
});

describe('CheckoutService delivery step', () => {
  const cartWith = (s) => s.cartService.addItem(null, 19, 2).cartId;

  it('needs a cart with items', () => {
    const s = makeServices('off');
    assert.throws(() => s.checkoutService.setDelivery(null, { ...VALID_DELIVERY, slotId: FRI_12 }), ConflictError);
  });

  it('reports field errors and a missing slot', () => {
    const s = makeServices('off');
    const cartId = cartWith(s);
    assert.throws(
      () => s.checkoutService.setDelivery(cartId, { ...VALID_DELIVERY, zip: '12', slotId: '' }),
      (e) => e instanceof ValidationError && Boolean(e.extra.fieldErrors.zip) && e.extra.fieldErrors.slotId === 'Yetkazib berish vaqtini tanlang',
    );
  });

  it('refuses an unavailable slot and stores a valid choice with its label', () => {
    const s = makeServices('off');
    const cartId = cartWith(s);
    assert.throws(() => s.checkoutService.setDelivery(cartId, { ...VALID_DELIVERY, slotId: FRI_10 }), ConflictError);
    assert.throws(() => s.checkoutService.setDelivery(cartId, { ...VALID_DELIVERY, slotId: 'bogus' }), ConflictError);
    const view = s.checkoutService.setDelivery(cartId, { ...VALID_DELIVERY, slotId: FRI_12 });
    assert.equal(view.delivery.slotLabel, 'Ju 20 Noy, 12:00-14:00');
    assert.equal(view.delivery.fullName, 'Amina Test');
  });

  it('FC_FULL_SLOT_SELECTABLE on: the server accepts the full slot', () => {
    const s = makeServices('on');
    const cartId = cartWith(s);
    assert.equal(s.checkoutService.setDelivery(cartId, { ...VALID_DELIVERY, slotId: FRI_10 }).delivery.slotId, FRI_10);
  });
});

describe('CheckoutService payment', () => {
  function ready(mode) {
    const s = makeServices(mode);
    const cartId = s.cartService.addItem(null, 19, 2).cartId;
    s.checkoutService.setDelivery(cartId, { ...VALID_DELIVERY, slotId: FRI_12 });
    return { ...s, cartId };
  }

  it('needs items and a chosen slot', async () => {
    const s = makeServices('off');
    await assert.rejects(s.checkoutService.pay(null, VALID_CARD), (e) => e instanceof ConflictError && e.message === "Savatingiz bo'sh");
    const cartId = s.cartService.addItem(null, 19, 1).cartId;
    await assert.rejects(s.checkoutService.pay(cartId, VALID_CARD), (e) => e.message === 'Avval yetkazib berish vaqtini tanlang');
  });

  it('creates an order snapshot with an FC- number and books the slot', async () => {
    const s = ready('off');
    const before = s.checkoutService.slots().flatMap((d) => d.slots).find((x) => x.id === FRI_12).remaining;
    const order = await s.checkoutService.pay(s.cartId, VALID_CARD);
    assert.equal(order.number, 'FC-100231');
    assert.equal(order.totals.totalCents, 832); // 2 x $2.00 + $4.00 delivery + $0.32 tax
    assert.equal(order.lines[0].name, 'Banan 1 kg');
    assert.equal(order.delivery.slotLabel, 'Ju 20 Noy, 12:00-14:00');
    assert.equal(order.last4, '4242');
    assert.equal(order.createdAt, toLocalIso(s.clock.now()));
    const after = s.checkoutService.slots().flatMap((d) => d.slots).find((x) => x.id === FRI_12).remaining;
    assert.equal(after, before - 1);
    assert.equal(s.checkoutService.getOrder('FC-100231').number, order.number);
    assert.equal(s.checkoutService.listOrders().length, 1);
    assert.throws(() => s.checkoutService.getOrder('FC-1'), NotFoundError);
  });

  it('FC_DOUBLE_SUBMIT_TWO_ORDERS on: two quick payments create FC-100231 and FC-100232', async () => {
    const s = ready('on');
    const [a, b] = await Promise.all([s.checkoutService.pay(s.cartId, VALID_CARD), s.checkoutService.pay(s.cartId, VALID_CARD)]);
    assert.deepEqual([a.number, b.number].sort(), ['FC-100231', 'FC-100232']);
    assert.equal(s.checkoutService.listOrders().length, 2);
  });

  it('FC_DOUBLE_SUBMIT_TWO_ORDERS off: the second payment is refused and the cart is emptied', async () => {
    const s = ready('off');
    const results = await Promise.allSettled([s.checkoutService.pay(s.cartId, VALID_CARD), s.checkoutService.pay(s.cartId, VALID_CARD)]);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'rejected');
    assert.match(results[1].reason.message, /allaqachon amalga oshirilmoqda/);
    assert.equal(s.checkoutService.listOrders().length, 1);
    await assert.rejects(s.checkoutService.pay(s.cartId, VALID_CARD), (e) => e.message === "Savatingiz bo'sh");
  });

  it('FC_DECLINE_SHOWS_CONFIRMATION on: the decline test card is approved', async () => {
    const s = ready('on');
    const order = await s.checkoutService.pay(s.cartId, { ...VALID_CARD, number: '4000 0000 0000 0002' });
    assert.equal(order.number, 'FC-100231');
  });

  it('FC_DECLINE_SHOWS_CONFIRMATION off: the decline test card is declined and the cart is kept', async () => {
    const s = ready('off');
    await assert.rejects(
      s.checkoutService.pay(s.cartId, { ...VALID_CARD, number: '4000 0000 0000 0002' }),
      (e) => e instanceof PaymentDeclinedError && e.message === 'To\'lov rad etildi. Boshqa kartani sinab ko\'ring.',
    );
    assert.equal(s.checkoutService.listOrders().length, 0);
    assert.equal(s.cartService.get(s.cartId).lines.length, 1);
  });

  it('FC_NO_LUHN and FC_EXPIRY_MONTH_ONLY on: a bad number and an old year are paid', async () => {
    const s = ready('on');
    const order = await s.checkoutService.pay(s.cartId, { ...VALID_CARD, number: '4111 1111 1111 1112', expiry: '12/20' });
    assert.ok(order.number.startsWith('FC-'));
  });

  it('FC_NO_LUHN and FC_EXPIRY_MONTH_ONLY off: both are refused with field errors', async () => {
    const s = ready('off');
    await assert.rejects(
      s.checkoutService.pay(s.cartId, { ...VALID_CARD, number: '4111 1111 1111 1112', expiry: '12/20' }),
      (e) => e instanceof ValidationError && Boolean(e.extra.fieldErrors.number && e.extra.fieldErrors.expiry),
    );
  });
});
