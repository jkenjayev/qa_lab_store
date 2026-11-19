import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addToLines, assertQuantity, maxQuantity, removeLine, setLineQuantity } from '../src/domain/cart.js';
import { ValidationError } from '../src/domain/errors.js';
import { computeTotals } from '../src/domain/pricing.js';
import { applyPromo, discountFor } from '../src/domain/promo.js';
import { formatMoney, percentOf } from '../src/shared/money.js';
import { COMPLETE, OFF, ON, PARTIAL } from './helpers.js';

const line = (unitPriceCents, quantity = 1) => ({ unitPriceCents, quantity });
const totals = (lines, defects, features = PARTIAL, promoCodes = []) =>
  computeTotals({ lines, promoCodes, defects, features });
const rejects = (fn, message) =>
  assert.throws(fn, (e) => e instanceof ValidationError && e.message === message);

describe('money helpers', () => {
  it('formats cents and rounds percentages', () => {
    assert.equal(formatMoney(120), '$1.20');
    assert.equal(formatMoney(-400), '-$4.00');
    assert.equal(percentOf(1999, 10), 200);
    assert.equal(percentOf(690, 8), 55);
  });
});

describe('F2.2 totals', () => {
  const cart = [line(120, 2), line(450, 1)];

  it('FC_TAX_ON_DELIVERY on: tax is 8% of subtotal plus delivery', () => {
    const t = totals(cart, ON);
    assert.deepEqual(t, { subtotalCents: 690, discountCents: 0, deliveryCents: 400, taxCents: 87, totalCents: 1177 });
  });

  it('FC_TAX_ON_DELIVERY off: tax is 8% of the subtotal', () => {
    const t = totals(cart, OFF, COMPLETE);
    assert.deepEqual(t, { subtotalCents: 690, discountCents: 0, deliveryCents: 400, taxCents: 55, totalCents: 1145 });
  });

  it('FC_FREE_DELIVERY_35 on: $30.00 and $32.00 pay delivery, $35.00 is free', () => {
    assert.equal(totals([line(3000)], ON).deliveryCents, 400);
    assert.equal(totals([line(3200)], ON).deliveryCents, 400);
    const t = totals([line(3500)], ON);
    assert.equal(t.deliveryCents, 0);
    assert.equal(t.taxCents, 280);
    assert.equal(t.totalCents, 3780);
  });

  it('FC_FREE_DELIVERY_35 off: exactly $30.00 is free, $29.99 is not', () => {
    assert.equal(totals([line(3000)], OFF).deliveryCents, 0);
    assert.equal(totals([line(2999)], OFF).deliveryCents, 400);
  });

  it('an empty cart costs nothing', () => {
    assert.deepEqual(totals([], ON), { subtotalCents: 0, discountCents: 0, deliveryCents: 0, taxCents: 0, totalCents: 0 });
  });

  it('F2.3 AC5: tax after the discount only once that feature is built', () => {
    const lines = [line(1000, 4)];
    const partial = totals(lines, OFF, PARTIAL, ['FRESH10']);
    assert.equal(partial.discountCents, 400);
    assert.equal(partial.taxCents, 320);
    assert.equal(partial.totalCents, 3920);
    const complete = totals(lines, OFF, COMPLETE, ['FRESH10']);
    assert.equal(complete.taxCents, 288);
    assert.equal(complete.totalCents, 3888);
  });
});

describe('F2.3 promo codes', () => {
  it('FC_PROMO_CASE_SENSITIVE on: fresh10 is not valid', () => {
    rejects(() => applyPromo([], 'fresh10', 4000, ON), 'Promokod yaroqsiz');
    assert.deepEqual(applyPromo([], 'FRESH10', 4000, ON), ['FRESH10']);
  });

  it('FC_PROMO_CASE_SENSITIVE off: fresh10 works like FRESH10', () => {
    assert.deepEqual(applyPromo([], ' fresh10 ', 4000, OFF), ['FRESH10']);
  });

  it('FC_PROMO_MIN_NOT_ENFORCED on: FRESH10 is applied at $19.99 with a $2.00 discount', () => {
    const codes = applyPromo([], 'FRESH10', 1999, ON);
    assert.deepEqual(codes, ['FRESH10']);
    assert.equal(discountFor(codes, 1999), 200);
  });

  it('FC_PROMO_MIN_NOT_ENFORCED off: FRESH10 needs $20.00', () => {
    rejects(() => applyPromo([], 'FRESH10', 1999, OFF), 'Bu promokoddan foydalanish uchun yana $0.01 qo\'shing.');
  });

  it('SAVE5 always enforces its $25.00 minimum', () => {
    rejects(() => applyPromo([], 'SAVE5', 2400, ON), 'Bu promokoddan foydalanish uchun yana $1.00 qo\'shing.');
    assert.deepEqual(applyPromo([], 'SAVE5', 2600, ON), ['SAVE5']);
    assert.equal(discountFor(['SAVE5'], 2600), 500);
  });

  it('FC_PROMO_EXPIRED_MESSAGE on: an expired code says it is not valid', () => {
    rejects(() => applyPromo([], 'SUMMER20', 4000, ON), 'Promokod yaroqsiz');
  });

  it('FC_PROMO_EXPIRED_MESSAGE off: an expired code says it has expired', () => {
    rejects(() => applyPromo([], 'SUMMER20', 4000, OFF), 'Promokod muddati tugagan');
  });

  it('FC_PROMO_STACKING on: a second code is added, discount $9.00 on $40.00', () => {
    const codes = applyPromo(['FRESH10'], 'SAVE5', 4000, ON);
    assert.deepEqual(codes, ['FRESH10', 'SAVE5']);
    assert.equal(discountFor(codes, 4000), 900);
  });

  it('FC_PROMO_STACKING off: a new code replaces the old one', () => {
    assert.deepEqual(applyPromo(['FRESH10'], 'SAVE5', 4000, OFF), ['SAVE5']);
  });

  it('rejects unknown and empty codes and caps the discount at the subtotal', () => {
    rejects(() => applyPromo([], 'NOPE', 4000, OFF), 'Promokod yaroqsiz');
    rejects(() => applyPromo([], '  ', 4000, OFF), 'Promokodni kiriting');
    assert.equal(discountFor(['SAVE5'], 300), 300);
    assert.equal(discountFor(['GONE'], 300), 0);
  });
});

describe('F2.1 cart rules', () => {
  const ids = () => {
    let n = 1;
    return () => `L${n++}`;
  };

  it('FC_CART_DUPLICATE_LINE on: adding the same product twice gives two lines of x1', () => {
    const newLineId = ids();
    let { lines } = addToLines([], 12, 1, { defects: ON, newLineId });
    ({ lines } = addToLines(lines, 12, 1, { defects: ON, newLineId }));
    assert.deepEqual(lines.map((l) => [l.productId, l.quantity]), [[12, 1], [12, 1]]);
  });

  it('FC_CART_DUPLICATE_LINE on: a line holding more than 1 unit is merged into', () => {
    const { lines } = addToLines([{ lineId: 'L1', productId: 19, quantity: 3 }], 19, 1, { defects: ON, newLineId: ids() });
    assert.deepEqual(lines, [{ lineId: 'L1', productId: 19, quantity: 4 }]);
  });

  it('FC_CART_DUPLICATE_LINE off: adding the same product twice gives one line x2', () => {
    const newLineId = ids();
    let { lines } = addToLines([], 12, 1, { defects: OFF, newLineId });
    ({ lines } = addToLines(lines, 12, 1, { defects: OFF, newLineId }));
    assert.deepEqual(lines.map((l) => [l.productId, l.quantity]), [[12, 2]]);
  });

  it('FC_CART_LIMIT_100 on: 99 plus 1 gives 100 without a message, the next unit is cut', () => {
    assert.equal(maxQuantity(ON), 100);
    const at99 = [{ lineId: 'L1', productId: 5, quantity: 99 }];
    const first = addToLines(at99, 5, 1, { defects: ON, newLineId: ids() });
    assert.equal(first.lines[0].quantity, 100);
    assert.equal(first.limitReached, false);
    const second = addToLines(first.lines, 5, 1, { defects: ON, newLineId: ids() });
    assert.equal(second.lines[0].quantity, 100);
    assert.equal(second.limitReached, true);
  });

  it('FC_CART_LIMIT_100 off: the limit is 99 and reaching it is reported', () => {
    assert.equal(maxQuantity(OFF), 99);
    const at98 = [{ lineId: 'L1', productId: 5, quantity: 98 }];
    const r = addToLines(at98, 5, 3, { defects: OFF, newLineId: ids() });
    assert.equal(r.lines[0].quantity, 99);
    assert.equal(r.limitReached, true);
    const fresh = addToLines([], 5, 150, { defects: OFF, newLineId: ids() });
    assert.equal(fresh.lines[0].quantity, 99);
    assert.equal(fresh.limitReached, true);
  });

  it('setLineQuantity keeps the minimum of 1 and clamps to the limit', () => {
    const lines = [{ lineId: 'L1', productId: 1, quantity: 2 }];
    assert.throws(() => setLineQuantity(lines, 'L1', 0, OFF), ValidationError);
    assert.throws(() => assertQuantity(1.5), ValidationError);
    const r = setLineQuantity(lines, 'L1', 120, OFF);
    assert.equal(r.lines[0].quantity, 99);
    assert.equal(r.limitReached, true);
    assert.equal(setLineQuantity(lines, 'L1', 5, OFF).limitReached, false);
  });

  it('removeLine drops one line', () => {
    const lines = [{ lineId: 'L1' }, { lineId: 'L2' }];
    assert.deepEqual(removeLine(lines, 'L1'), [{ lineId: 'L2' }]);
  });
});
