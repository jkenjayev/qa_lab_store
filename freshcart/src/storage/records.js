import { formatMoney } from '../shared/money.js';

/** Notion titles of the four FreshCart databases. */
export const DB_TITLES = Object.freeze({
  products: 'FC Products',
  promos: 'FC Promo Codes',
  carts: 'FC Carts',
  orders: 'FC Orders',
});

/** Entity -> { key, data, summary } rows. The summary is for people reading Notion. */
export const productRecord = (p) => ({
  key: String(p.id),
  data: p,
  summary: `${p.name} | ${p.category} | ${formatMoney(p.priceCents)} | stock ${p.stock}`,
});

export const promoRecord = (code, promo) => ({
  key: code,
  data: { code, ...promo },
  summary: `${code} | ${promo.type === 'percent' ? `${promo.value}%` : formatMoney(promo.value)} | min ${formatMoney(promo.minCents)}${promo.expired ? ' | expired' : ''}`,
});

export const cartRecord = (cart) => ({
  key: cart.id,
  data: cart,
  summary: `${cart.lines.length} line(s) | promo ${cart.promoCodes.join(',') || '-'} | ${cart.delivery ? 'delivery set' : 'no delivery'}`,
});

export const orderRecord = (order) => ({
  key: order.number,
  data: order,
  summary: `${order.number} | ${formatMoney(order.totals.totalCents)} | ${order.delivery?.city ?? ''}`,
});
