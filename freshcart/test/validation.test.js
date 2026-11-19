import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { luhn, validateCard, validateDelivery, validateEmail } from '../src/shared/validation.js';
import { OFF, ON, VALID_CARD, VALID_DELIVERY } from './helpers.js';

const NOW = new Date('2026-11-19T15:00:00');

describe('luhn and email', () => {
  it('checks card digit strings', () => {
    assert.equal(luhn('4242424242424242'), true);
    assert.equal(luhn('4111111111111111'), true);
    assert.equal(luhn('4111111111111112'), false);
  });

  it('validates email shape', () => {
    assert.equal(validateEmail('a@b.co'), null);
    assert.equal(validateEmail('nope'), 'To\'g\'ri email manzilini kiriting');
    assert.equal(validateEmail(undefined), 'To\'g\'ri email manzilini kiriting');
  });
});

describe('F2.4 delivery fields', () => {
  it('accepts a complete valid form, also with a formatted phone number', () => {
    assert.deepEqual(validateDelivery(VALID_DELIVERY, OFF), {});
    assert.deepEqual(validateDelivery({ ...VALID_DELIVERY, phone: '(555) 010-1234' }, OFF), {});
  });

  it('requires every field with the design messages', () => {
    assert.deepEqual(validateDelivery({}, OFF), {
      fullName: 'To\'liq ismingizni kiriting',
      phone: '10 xonali telefon raqamini kiriting',
      street: 'Ko\'cha manzilingizni kiriting',
      city: 'Shahringizni kiriting',
      zip: '5 xonali pochta indeksini kiriting',
    });
    assert.equal(validateDelivery({ ...VALID_DELIVERY, fullName: 'x'.repeat(61) }, OFF).fullName, 'To\'liq ismingizni kiriting');
  });

  it('FC_PHONE_ACCEPTS_LETTERS on: abc123xyz0 is accepted', () => {
    assert.equal(validateDelivery({ ...VALID_DELIVERY, phone: 'abc123xyz0' }, ON).phone, undefined);
    assert.equal(validateDelivery({ ...VALID_DELIVERY, phone: '12345' }, ON).phone, '10 xonali telefon raqamini kiriting');
  });

  it('FC_PHONE_ACCEPTS_LETTERS off: letters are refused', () => {
    assert.equal(validateDelivery({ ...VALID_DELIVERY, phone: 'abc123xyz0' }, OFF).phone, '10 xonali telefon raqamini kiriting');
  });

  it('FC_ZIP_FOUR_DIGITS on: 1234 is accepted, 6 digits are not', () => {
    assert.equal(validateDelivery({ ...VALID_DELIVERY, zip: '1234' }, ON).zip, undefined);
    assert.equal(validateDelivery({ ...VALID_DELIVERY, zip: '123456' }, ON).zip, '5 xonali pochta indeksini kiriting');
  });

  it('FC_ZIP_FOUR_DIGITS off: only 5 digits are accepted', () => {
    assert.equal(validateDelivery({ ...VALID_DELIVERY, zip: '1234' }, OFF).zip, '5 xonali pochta indeksini kiriting');
    assert.equal(validateDelivery({ ...VALID_DELIVERY, zip: '12345' }, OFF).zip, undefined);
  });
});

describe('F2.5 card fields', () => {
  const card = (over, defects) => validateCard({ ...VALID_CARD, ...over }, defects, NOW);

  it('accepts the success test card', () => {
    assert.deepEqual(card({}, OFF), {});
  });

  it('FC_NO_LUHN on: 4111 1111 1111 1112 is accepted, a short number is not', () => {
    assert.equal(card({ number: '4111 1111 1111 1112' }, ON).number, undefined);
    assert.equal(card({ number: '1234' }, ON).number, 'Karta raqami noto\'g\'ri');
  });

  it('FC_NO_LUHN off: 4111 1111 1111 1112 is refused', () => {
    assert.equal(card({ number: '4111 1111 1111 1112' }, OFF).number, 'Karta raqami noto\'g\'ri');
  });

  it('FC_EXPIRY_MONTH_ONLY on: 12/20 passes, 10/26 and the future 05/30 are refused', () => {
    assert.equal(card({ expiry: '12/20' }, ON).expiry, undefined);
    assert.equal(card({ expiry: '10/26' }, ON).expiry, 'Karta muddati tugagan');
    assert.equal(card({ expiry: '05/30' }, ON).expiry, 'Karta muddati tugagan');
  });

  it('FC_EXPIRY_MONTH_ONLY off: month and year are checked, the current month is valid', () => {
    assert.equal(card({ expiry: '12/20' }, OFF).expiry, 'Karta muddati tugagan');
    assert.equal(card({ expiry: '10/26' }, OFF).expiry, 'Karta muddati tugagan');
    assert.equal(card({ expiry: '11/26' }, OFF).expiry, undefined);
    assert.equal(card({ expiry: '05/30' }, OFF).expiry, undefined);
  });

  it('checks expiry format, CVC and name', () => {
    assert.equal(card({ expiry: '1/26' }, OFF).expiry, 'Amal qilish muddatini MM/YY ko\'rinishida kiriting');
    assert.equal(card({ cvc: '' }, OFF).cvc, '3 yoki 4 xonali CVC kodini kiriting');
    assert.equal(card({ cvc: '12345' }, OFF).cvc, '3 yoki 4 xonali CVC kodini kiriting');
    assert.equal(card({ name: ' ' }, OFF).name, 'Karta egasining ismini kiriting');
  });
});
