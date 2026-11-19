/**
 * Seeded defects of the FreshCart training build. One id per row of the Notion
 * "Seeded Defects (Facilitator Answer Key)" database (FreshCart rows).
 * Every defect is one small `if (defects.ID)` branch next to the correct code path.
 */
export const DEFECT_IDS = Object.freeze([
  // F1.1 Product listing page
  'FC_PAGE_SIZE_10', // Only 10 products per page
  'FC_PRICE_ONE_DECIMAL', // Prices shown with 1 decimal
  'FC_SORT_PRICE_DESC_ASC', // Price high to low sorts ascending
  // F1.2 Product search with suggestions
  'FC_SUGGEST_ONE_CHAR', // Suggestions appear after 1 character
  'FC_SEARCH_CASE_SENSITIVE', // Search is case-sensitive
  'FC_SEARCH_XSS_HEADING', // Search term is rendered as HTML in the results heading (XSS)
  'FC_SEARCH_NO_MAXLENGTH', // 50-character limit not enforced in search box
  // F1.3 Category and price filters
  'FC_PRICE_MAX_EXCLUSIVE', // Price Max is exclusive
  'FC_PRICE_MIN_GT_MAX_NO_ERROR', // No error when Min is greater than Max
  'FC_CATEGORY_URL_NOT_UPDATED', // Category filter does not update the URL
  // F1.4 Product detail page
  'FC_DETAIL_THREE_IMAGES', // Only 3 of 4 images shown
  'FC_STEPPER_MAX_11', // Quantity stepper allows 11
  'FC_TOAST_ONE_SECOND', // Toast disappears after 1 second
  'FC_DETAIL_404_BLANK', // Unknown product id shows a blank page
  // F1.5 Out-of-stock and Notify me
  'FC_OOS_ADD_ENABLED', // Add to cart still possible on out-of-stock product
  'FC_LOW_STOCK_AT_6', // Low-stock text shown for stock 6
  // F2.1 Add to cart and mini-cart
  'FC_BADGE_COUNTS_LINES', // Cart badge counts lines, not units
  'FC_CART_DUPLICATE_LINE', // Same product creates a duplicate cart line
  'FC_CART_LIMIT_100', // Quantity limit is 100, not 99
  'FC_CART_NOT_PERSISTED_ACROSS_TABS', // Cart is lost when the tab is closed
  // F2.2 Cart page quantity and totals
  'FC_FREE_DELIVERY_35', // Free delivery threshold is $35 instead of $30
  'FC_TAX_ON_DELIVERY', // Tax calculated on subtotal plus delivery
  'FC_EMPTY_CART_BLANK', // Empty cart shows a blank page
  // F2.3 Promo code
  'FC_PROMO_CASE_SENSITIVE', // Promo codes are case-sensitive
  'FC_PROMO_MIN_NOT_ENFORCED', // FRESH10 minimum subtotal not enforced
  'FC_PROMO_EXPIRED_MESSAGE', // Expired code shows the wrong message
  'FC_PROMO_STACKING', // Two promo codes stack
  // F2.4 Delivery slot and address step
  'FC_PHONE_ACCEPTS_LETTERS', // Phone field accepts letters
  'FC_ZIP_FOUR_DIGITS', // ZIP accepts 4 digits
  'FC_FULL_SLOT_SELECTABLE', // Full delivery slot can be selected
  'FC_SAME_DAY_CUTOFF_1H', // Same-day cutoff is 1 hour, not 2 hours
  // F2.5 Payment and order confirmation
  'FC_NO_LUHN', // Card number is not Luhn-validated
  'FC_EXPIRY_MONTH_ONLY', // Expiry checked by month only
  'FC_DOUBLE_SUBMIT_TWO_ORDERS', // Double click on Place order creates two orders
  'FC_DECLINE_SHOWS_CONFIRMATION', // Declined test card shows the confirmation page
]);

/** Read the mode from the environment: SEEDED_DEFECTS=off starts the reference-correct build. */
export function modeFromEnv(env = {}) {
  return String(env.SEEDED_DEFECTS ?? 'on').toLowerCase() === 'off' ? 'off' : 'on';
}

/** Mode `on` (default) enables every seeded defect, mode `off` enables none. */
export function createDefects(mode = 'on') {
  const enabled = mode !== 'off';
  return Object.freeze(Object.fromEntries(DEFECT_IDS.map((id) => [id, enabled])));
}
