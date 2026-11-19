import { MSG } from './messages.js';

/** Completed years on `today`. Both YYYY-MM-DD. */
export function completedYears(dob, today) {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let years = ty - by;
  if (tm < bm || (tm === bm && td < bd)) years -= 1;
  return years;
}

export const PASSWORD_RULES = Object.freeze([
  { key: 'length', label: '8 yoki undan ortiq belgi', test: (p) => p.length >= 8 },
  { key: 'upper', label: '1 ta bosh harf', test: (p) => /[A-Z]/.test(p) },
  { key: 'digit', label: '1 ta raqam', test: (p) => /\d/.test(p) },
]);

/** The three rules shown live under the password field. The labels never change. */
export function passwordRuleStates(password) {
  return PASSWORD_RULES.map((rule) => ({ key: rule.key, label: rule.label, ok: rule.test(password) }));
}

/** Server-side password check. */
export function passwordMeetsRules(password, defects) {
  // CB_PASSWORD_MIN_6 (Password of 6 characters is accepted): the minimum is 6 instead of 8.
  const minLength = defects.CB_PASSWORD_MIN_6 ? 6 : 8;
  return password.length >= minLength && /[A-Z]/.test(password) && /\d/.test(password);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Patient registration rules. `emailTaken(email)` is injected because only the server knows.
 * @returns {Record<string,string>} field -> message, empty when valid
 */
export function validateRegistration(input, { today, emailTaken, defects }) {
  const errors = {};
  const fullName = String(input.fullName ?? '').trim();
  const email = String(input.email ?? '').trim();
  const phoneDigits = String(input.phone ?? '').replace(/\D/g, '');
  const dob = String(input.dob ?? '');
  const password = String(input.password ?? '');

  if (!fullName || fullName.length > 80) errors.fullName = MSG.NAME_REQUIRED;
  if (!EMAIL.test(email)) errors.email = MSG.EMAIL_INVALID;
  else if (emailTaken(email)) errors.email = MSG.EMAIL_TAKEN;
  if (phoneDigits.length < 10 || phoneDigits.length > 12) errors.phone = MSG.PHONE_INVALID;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    errors.dob = MSG.DOB_REQUIRED;
  } else if (dob > today) {
    // CB_FUTURE_DOB_ACCEPTED (Future date of birth accepted): the future check is skipped.
    if (!defects.CB_FUTURE_DOB_ACCEPTED) errors.dob = MSG.DOB_FUTURE;
  } else if (completedYears(dob, today) < 18) {
    errors.dob = MSG.DOB_UNDER_18;
  }

  if (!passwordMeetsRules(password, defects)) errors.password = MSG.PASSWORD_RULES;
  if (String(input.confirmPassword ?? '') !== password) errors.confirmPassword = MSG.PASSWORD_MISMATCH;
  return errors;
}
