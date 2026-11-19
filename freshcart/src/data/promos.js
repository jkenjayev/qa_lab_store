/** Promo codes from the Notion design (F2.3). Keys are upper case. */
export const PROMOS = Object.freeze({
  FRESH10: Object.freeze({ type: 'percent', value: 10, minCents: 2000, expired: false }),
  SAVE5: Object.freeze({ type: 'fixed', value: 500, minCents: 2500, expired: false }),
  SUMMER20: Object.freeze({ type: 'percent', value: 20, minCents: 2000, expired: true }),
});
