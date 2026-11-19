/**
 * Field validation shared by the server and the browser (both import this file).
 * Messages are the ones in the Notion designs.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
  return EMAIL.test(String(email ?? '').trim()) ? null : "To'g'ri email manzilini kiriting";
}

/** Luhn checksum over a string of digits. */
export function luhn(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const required = (value) => String(value ?? '').trim();

/** Checkout step 2 fields. Returns a map of field name to message (empty when valid). */
export function validateDelivery(fields, defects = {}) {
  const errors = {};
  const fullName = required(fields.fullName);
  if (!fullName || fullName.length > 60) errors.fullName = "To'liq ismingizni kiriting";

  const phone = String(fields.phone ?? '').replace(/[\s()-]/g, '');
  // FC_PHONE_ACCEPTS_LETTERS: "Phone field accepts letters" - only the length is checked.
  const phoneOk = defects.FC_PHONE_ACCEPTS_LETTERS ? phone.length === 10 : /^\d{10}$/.test(phone);
  if (!phoneOk) errors.phone = '10 xonali telefon raqamini kiriting';

  const street = required(fields.street);
  if (!street || street.length > 100) errors.street = "Ko'cha manzilingizni kiriting";
  if (!required(fields.city)) errors.city = 'Shahringizni kiriting';

  const zip = required(fields.zip);
  // FC_ZIP_FOUR_DIGITS: "ZIP accepts 4 digits".
  const zipOk = defects.FC_ZIP_FOUR_DIGITS ? /^\d{4,5}$/.test(zip) : /^\d{5}$/.test(zip);
  if (!zipOk) errors.zip = '5 xonali pochta indeksini kiriting';
  return errors;
}

/** Payment step fields. `now` is the current date (injected clock). */
export function validateCard(fields, defects = {}, now = new Date()) {
  const errors = {};
  const number = String(fields.number ?? '').replace(/[\s-]/g, '');
  const shapeOk = /^\d{13,19}$/.test(number);
  // FC_NO_LUHN: "Card number is not Luhn-validated" - only the shape is checked.
  if (!shapeOk || (!defects.FC_NO_LUHN && !luhn(number))) errors.number = "Karta raqami noto'g'ri";

  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(String(fields.expiry ?? '').trim());
  if (!match) {
    errors.expiry = "Amal qilish muddatini MM/YY ko'rinishida kiriting";
  } else {
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    // FC_EXPIRY_MONTH_ONLY: "Expiry checked by month only" - the year is ignored.
    const expired = defects.FC_EXPIRY_MONTH_ONLY
      ? month < curMonth
      : year < curYear || (year === curYear && month < curMonth);
    if (expired) errors.expiry = 'Karta muddati tugagan';
  }

  if (!/^\d{3,4}$/.test(String(fields.cvc ?? '').trim())) errors.cvc = '3 yoki 4 xonali CVC kodini kiriting';
  if (!required(fields.name)) errors.name = "Karta egasining ismini kiriting";
  return errors;
}
