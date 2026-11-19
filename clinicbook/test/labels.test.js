import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DAY_LABEL, ROLE_LABEL, STATUS_LABEL, roleLabel, statusLabel } from '../src/shared/labels.js';
import { MSG } from '../src/shared/messages.js';

describe('Uzbek display labels', () => {
  it('translate every status and role code and keep unknown values unchanged', () => {
    assert.deepEqual(Object.keys(STATUS_LABEL), ['Booked', 'Completed', 'Cancelled', 'No-show']);
    assert.equal(statusLabel('Booked'), 'Band qilingan');
    assert.equal(statusLabel('Orphaned'), 'Orphaned');
    assert.deepEqual(Object.keys(ROLE_LABEL), ['Admin', 'Receptionist', 'Doctor']);
    assert.equal(roleLabel('Receptionist'), 'Qabulxona xodimi');
    assert.equal(roleLabel('Guest'), 'Guest');
  });

  it('has seven day names starting with Sunday', () => {
    assert.equal(DAY_LABEL.length, 7);
    assert.equal(DAY_LABEL[0], 'Yakshanba');
    assert.equal(DAY_LABEL[1], 'Dushanba');
  });

  it('has a non-empty Uzbek text for every message', () => {
    for (const [key, text] of Object.entries(MSG)) assert.ok(text.length > 3, key);
    assert.equal(MSG.CLINIC_ADDRESS, '12 Garden Street, Block B');
    assert.match(MSG.SESSION_EXPIRED, /Seans/);
  });
});
