/** Money helpers shared by server and browser. All amounts are integer cents. */

export function formatMoney(cents) {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** pct percent of an amount in cents, rounded to the nearest cent. */
export function percentOf(cents, pct) {
  return Math.round((cents * pct) / 100);
}
