import { PROMOS } from '../data/promos.js';
import { formatMoney, percentOf } from '../shared/money.js';
import { ValidationError } from './errors.js';

function lookup(rawCode, defects, promos) {
  const trimmed = String(rawCode ?? '').trim();
  // FC_PROMO_CASE_SENSITIVE: "Promo codes are case-sensitive" - fresh10 is not found.
  const key = defects.FC_PROMO_CASE_SENSITIVE ? trimmed : trimmed.toUpperCase();
  return promos[key] ? { code: key, ...promos[key] } : null;
}

/**
 * Validate a code against the cart subtotal and return the new list of active codes.
 * Throws ValidationError with the message shown under the promo input.
 */
export function applyPromo(currentCodes, rawCode, subtotalCents, defects, promos = PROMOS) {
  if (!String(rawCode ?? '').trim()) throw new ValidationError('Promokodni kiriting');
  const promo = lookup(rawCode, defects, promos);
  if (!promo) throw new ValidationError('Promokod yaroqsiz');
  if (promo.expired) {
    // FC_PROMO_EXPIRED_MESSAGE: "Expired code shows the wrong message"
    throw new ValidationError(defects.FC_PROMO_EXPIRED_MESSAGE ? 'Promokod yaroqsiz' : 'Promokod muddati tugagan');
  }
  // FC_PROMO_MIN_NOT_ENFORCED: "FRESH10 minimum subtotal not enforced"
  const skipMinimum = defects.FC_PROMO_MIN_NOT_ENFORCED && promo.code === 'FRESH10';
  if (!skipMinimum && subtotalCents < promo.minCents) {
    throw new ValidationError(`Bu promokoddan foydalanish uchun yana ${formatMoney(promo.minCents - subtotalCents)} qo'shing.`);
  }
  // FC_PROMO_STACKING: "Two promo codes stack" - the new code is added instead of replacing.
  if (defects.FC_PROMO_STACKING) return [...new Set([...currentCodes, promo.code])];
  return [promo.code];
}

/** Total discount of the active codes, never more than the subtotal. */
export function discountFor(codes, subtotalCents, promos = PROMOS) {
  const total = codes.reduce((sum, code) => {
    const promo = promos[code];
    if (!promo) return sum;
    return sum + (promo.type === 'percent' ? percentOf(subtotalCents, promo.value) : promo.value);
  }, 0);
  return Math.min(total, subtotalCents);
}
