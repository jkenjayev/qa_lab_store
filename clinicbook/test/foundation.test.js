import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../src/clock.js';
import { loadConfig } from '../src/config.js';
import { DEFECT_IDS, DEFECT_TITLES, createDefects, defectsFromEnv, onlyDefects } from '../src/defects.js';
import { ConfigError } from '../src/domain/errors.js';
import { hashPassword, verifyPassword } from '../src/domain/password.js';

describe('defects', () => {
  it('lists exactly 36 defects with unique titles', () => {
    assert.equal(DEFECT_IDS.length, 36);
    assert.equal(new Set(Object.values(DEFECT_TITLES)).size, 36);
  });
  it('mode on enables all, mode off enables none, onlyDefects picks some', () => {
    assert.ok(DEFECT_IDS.every((id) => createDefects('on')[id] === true));
    assert.ok(DEFECT_IDS.every((id) => createDefects('off')[id] === false));
    const some = onlyDefects('CB_SLOTS_12H');
    assert.equal(some.CB_SLOTS_12H, true);
    assert.equal(some.CB_PAST_SLOTS_SHOWN, false);
  });
  it('reads SEEDED_DEFECTS from the environment', () => {
    assert.equal(defectsFromEnv({}).CB_SLOTS_12H, true);
    assert.equal(defectsFromEnv({ SEEDED_DEFECTS: 'OFF' }).CB_SLOTS_12H, false);
    assert.equal(defectsFromEnv({ SEEDED_DEFECTS: 'on' }).CB_SLOTS_12H, true);
  });
});

describe('clock', () => {
  it('is fixed, can be set and advanced', () => {
    const clock = createClock({ fixedNow: '2026-11-19T13:10:00' });
    assert.equal(clock.now().toISOString(), '2026-11-19T13:10:00.000Z');
    clock.advance(50);
    assert.equal(clock.now().toISOString(), '2026-11-19T14:00:00.000Z');
    clock.set('2026-11-19T10:00');
    assert.equal(clock.now().toISOString(), '2026-11-19T10:00:00.000Z');
    assert.equal(clock.nowMinutes(), Date.parse('2026-11-19T10:00:00Z') / 60000);
    assert.throws(() => clock.set('not a date'), RangeError);
  });
  it('real mode follows the injected real time plus the clinic offset and can be moved', () => {
    let real = Date.parse('2026-01-01T00:00:00Z');
    const clock = createClock({ real: true, realNow: () => real });
    assert.equal(clock.isReal, true);
    assert.equal(clock.now().toISOString(), '2026-01-01T05:00:00.000Z');
    clock.advance(60);
    assert.equal(clock.now().toISOString(), '2026-01-01T06:00:00.000Z');
    clock.set('2026-06-01T12:00');
    assert.equal(clock.now().toISOString(), '2026-06-01T12:00:00.000Z');
    real += 60000;
    assert.equal(clock.now().toISOString(), '2026-06-01T12:01:00.000Z');
  });
  it('default fixed time is 13:10 on 19 Noy 2026', () => {
    assert.equal(createClock().now().toISOString(), '2026-11-19T13:10:00.000Z');
  });
});

describe('config', () => {
  it('refuses to start without TRAINING_PASSWORD', () => {
    assert.throws(() => loadConfig({}), ConfigError);
    assert.throws(() => loadConfig({}), /TRAINING_PASSWORD/);
  });
  it('uses defaults', () => {
    const config = loadConfig({ TRAINING_PASSWORD: 'x' });
    assert.equal(config.port, 3202);
    assert.equal(config.defects.CB_SLOTS_12H, true);
    assert.equal(config.clock.isReal, false);
    assert.equal(config.clock.now().toISOString(), '2026-11-19T13:10:00.000Z');
  });
  it('honours PORT, SEEDED_DEFECTS=off and FIXED_NOW', () => {
    const config = loadConfig({ TRAINING_PASSWORD: 'x', PORT: '4000', SEEDED_DEFECTS: 'off', FIXED_NOW: '2026-11-19T10:00:00' });
    assert.equal(config.port, 4000);
    assert.equal(config.defects.CB_SLOTS_12H, false);
    assert.equal(config.clock.now().toISOString(), '2026-11-19T10:00:00.000Z');
    assert.equal(loadConfig({ TRAINING_PASSWORD: 'x', FIXED_NOW: 'off' }).clock.isReal, true);
  });
});

describe('password hashing', () => {
  it('verifies the right password only and salts every hash', () => {
    const a = hashPassword('secret-1');
    assert.notEqual(a, hashPassword('secret-1'));
    assert.equal(verifyPassword('secret-1', a), true);
    assert.equal(verifyPassword('secret-2', a), false);
    assert.equal(verifyPassword('x', 'broken'), false);
  });
});
