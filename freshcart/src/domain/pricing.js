import { percentOf } from '../shared/money.js';
import { PROMOS } from '../data/promos.js';
import { discountFor } from './promo.js';

export const DELIVERY_FEE_CENTS = 400;
export const TAX_PERCENT = 8;

/**
 * Order totals. lines: [{ unitPriceCents, quantity }].
 * Rules: delivery $4.00 under $30.00 (from $30.00 free), tax 8% rounded to cents,
 * total = subtotal - discount + delivery + tax.
 */
export function computeTotals({ lines, promoCodes, defects, features, promos = PROMOS }) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const discountCents = discountFor(promoCodes, subtotalCents, promos);

  // FC_FREE_DELIVERY_35: "Free delivery threshold is $35 instead of $30"
  const freeFrom = defects.FC_FREE_DELIVERY_35 ? 3500 : 3000;
  const deliveryCents = subtotalCents === 0 || subtotalCents >= freeFrom ? 0 : DELIVERY_FEE_CENTS;

  // Tax is calculated after the discount once that feature is built (F2.3 AC5).
  let taxBase = subtotalCents - (features.discountBeforeTax ? discountCents : 0);
  // FC_TAX_ON_DELIVERY: "Tax calculated on subtotal plus delivery"
  if (defects.FC_TAX_ON_DELIVERY) taxBase += deliveryCents;
  const taxCents = percentOf(taxBase, TAX_PERCENT);

  return {
    subtotalCents,
    discountCents,
    deliveryCents,
    taxCents,
    totalCents: subtotalCents - discountCents + deliveryCents + taxCents,
  };
}
