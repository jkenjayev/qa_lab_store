/** Price formats. Prices are integer cents. */

export function formatPrice(cents) {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** Price on a product card. */
export function formatCardPrice(cents, defects) {
  // FC_PRICE_ONE_DECIMAL: "Prices shown with 1 decimal"
  if (defects.FC_PRICE_ONE_DECIMAL) return `$${(cents / 100).toFixed(1)}`;
  return formatPrice(cents);
}

/** mm:ss for the slot hold countdown. */
export function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
