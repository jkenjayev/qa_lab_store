import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_NOW, createClock, dateKey, toLocalIso } from '../src/clock.js';
import { InMemoryCartRepository, InMemoryOrderRepository, InMemoryProductRepository } from '../src/data/repositories.js';
import { DEFECT_IDS, createDefects, modeFromEnv } from '../src/defects.js';
import { HttpError, NotFoundError, PaymentDeclinedError, ValidationError } from '../src/domain/errors.js';
import { productImageSvg } from '../src/domain/images.js';
import { DECLINE_CARD, MockPaymentGateway } from '../src/domain/payment.js';
import { FEATURE_IDS, createFeatures } from '../src/features.js';
import { OFF, ON } from './helpers.js';

describe('defects and features', () => {
  it('has 35 unique defect ids, all FC_ prefixed', () => {
    assert.equal(DEFECT_IDS.length, 35);
    assert.equal(new Set(DEFECT_IDS).size, 35);
    assert.ok(DEFECT_IDS.every((id) => /^FC_[A-Z0-9_]+$/.test(id)));
  });

  it('mode on enables every defect, mode off none', () => {
    assert.ok(DEFECT_IDS.every((id) => ON[id] === true));
    assert.ok(DEFECT_IDS.every((id) => OFF[id] === false));
    assert.ok(Object.isFrozen(createDefects()));
    assert.equal(createDefects()[DEFECT_IDS[0]], true);
  });

  it('reads the mode from the environment', () => {
    assert.equal(modeFromEnv({}), 'on');
    assert.equal(modeFromEnv({ SEEDED_DEFECTS: 'on' }), 'on');
    assert.equal(modeFromEnv({ SEEDED_DEFECTS: 'OFF' }), 'off');
    assert.equal(modeFromEnv(), 'on');
  });

  it('leaves the not-built features out of the training build only', () => {
    assert.ok(FEATURE_IDS.every((id) => createFeatures('on')[id] === false));
    assert.ok(FEATURE_IDS.every((id) => createFeatures('off')[id] === true));
    assert.equal(createFeatures().notifyMe, false);
  });
});

describe('clock', () => {
  it('defaults to the walkthrough clock', () => {
    assert.equal(toLocalIso(createClock({}).now()), DEFAULT_NOW);
  });

  it('can be set, returns fresh dates and can follow the real time', () => {
    const fixed = createClock({ FIXED_NOW: '2026-12-01T08:30:00' });
    assert.equal(toLocalIso(fixed.now()), '2026-12-01T08:30:00');
    assert.notEqual(fixed.now(), fixed.now());
    const real = createClock({ FIXED_NOW: 'off' }).now().getTime();
    assert.ok(Math.abs(real - Date.now()) < 5000);
  });

  it('refuses an invalid date and formats local dates', () => {
    assert.throws(() => createClock({ FIXED_NOW: 'banana' }), /yaroqli sana emas/);
    assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05');
  });
});

describe('errors, images, repositories and the mock gateway', () => {
  it('carries status codes', () => {
    assert.equal(new ValidationError('x').status, 400);
    assert.deepEqual(new ValidationError('x', { a: 'b' }).extra, { fieldErrors: { a: 'b' } });
    assert.equal(new NotFoundError('x').status, 404);
    assert.equal(new PaymentDeclinedError().status, 402);
    assert.equal(new HttpError(418, 't').name, 'HttpError');
  });

  it('draws a placeholder picture', () => {
    const svg = productImageSvg({ id: 12, name: 'Sut, to\'liq yog\'li 1 l', category: 'dairy' }, 2);
    assert.match(svg, /^<svg/);
    assert.match(svg, />S</);
    assert.match(svg, /rasm 2/);
    assert.match(productImageSvg({ id: 1, name: 'x', category: 'unknown' }, 1), /#EEEEEE/);
  });

  it('product repository finds by id', () => {
    const repo = new InMemoryProductRepository([{ id: 1 }, { id: 2 }]);
    assert.equal(repo.all().length, 2);
    assert.equal(repo.byId(2).id, 2);
    assert.equal(repo.byId(3), null);
  });

  it('order repository numbers orders from FC-100231', () => {
    const repo = new InMemoryOrderRepository();
    assert.equal(repo.nextNumber(), 'FC-100231');
    repo.add({ number: repo.nextNumber() });
    assert.equal(repo.nextNumber(), 'FC-100232');
    assert.equal(repo.byNumber('FC-100231').number, 'FC-100231');
    assert.equal(repo.byNumber('x'), null);
    assert.equal(repo.all().length, 1);
  });

  it('cart repository stores and expires carts', () => {
    let t = 0;
    const repo = new InMemoryCartRepository({ now: () => new Date(t) });
    const cart = repo.create();
    assert.equal(repo.get(cart.id).id, cart.id);
    assert.equal(repo.get('nope'), null);
    t = 7 * 24 * 3600 * 1000;
    assert.equal(repo.get(cart.id).id, cart.id);
    repo.save(cart);
    t += 7 * 24 * 3600 * 1000 + 1;
    assert.equal(repo.get(cart.id), null);
  });

  it('FC_DECLINE_SHOWS_CONFIRMATION: the mock approves everything on, declines the test card off', async () => {
    assert.deepEqual(await new MockPaymentGateway({ defects: ON }).charge({ number: DECLINE_CARD }), { approved: true, last4: '0002' });
    assert.deepEqual(await new MockPaymentGateway({ defects: OFF }).charge({ number: '4000 0000 0000 0002' }), { approved: false });
    assert.equal((await new MockPaymentGateway({ defects: OFF }).charge({ number: '4242424242424242' })).last4, '4242');
  });
});
