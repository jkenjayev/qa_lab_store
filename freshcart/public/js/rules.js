/** Small pure UI rules. Each one holds the browser side of a seeded defect, next to the correct rule. */

/** Number shown in the header cart badge. */
export function badgeCount(lines, defects) {
  // FC_BADGE_COUNTS_LINES: "Cart badge counts lines, not units"
  if (defects.FC_BADGE_COUNTS_LINES) return lines.length;
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Largest quantity of the stepper on the product detail page. */
export function stepperMax(defects) {
  // FC_STEPPER_MAX_11: "Quantity stepper allows 11"
  return defects.FC_STEPPER_MAX_11 ? 11 : 10;
}

/** How long the Added to cart toast stays visible. */
export function toastMs(defects) {
  // FC_TOAST_ONE_SECOND: "Toast disappears after 1 second"
  return defects.FC_TOAST_ONE_SECOND ? 1000 : 4000;
}

/** Characters needed in the header search box before suggestions are requested. */
export function suggestMinChars(defects) {
  // FC_SUGGEST_ONE_CHAR: "Suggestions appear after 1 character"
  return defects.FC_SUGGEST_ONE_CHAR ? 1 : 2;
}

/** maxlength of the search input; null means no limit attribute. */
export function searchMaxLength(defects) {
  // FC_SEARCH_NO_MAXLENGTH: "50-character limit not enforced in search box"
  return defects.FC_SEARCH_NO_MAXLENGTH ? null : 50;
}

/** Whether choosing a category also changes the address bar URL. */
export function shouldPushCategoryUrl(defects) {
  // FC_CATEGORY_URL_NOT_UPDATED: "Category filter does not update the URL"
  return !defects.FC_CATEGORY_URL_NOT_UPDATED;
}

/** Where the cart id is kept: survives closing the tab (local) or not (session). */
export function cartStorageKind(defects) {
  // FC_CART_NOT_PERSISTED_ACROSS_TABS: "Cart is lost when the tab is closed"
  return defects.FC_CART_NOT_PERSISTED_ACROSS_TABS ? 'session' : 'local';
}

/** How many thumbnails the detail page shows for a product with `imageCount` images. */
export function thumbnailCount(imageCount, defects) {
  // FC_DETAIL_THREE_IMAGES: "Only 3 of 4 images shown"
  return defects.FC_DETAIL_THREE_IMAGES ? Math.min(imageCount, 3) : imageCount;
}

/** Whether a missing product renders the Product not found page (otherwise a blank page). */
export function showProductNotFoundPage(defects) {
  // FC_DETAIL_404_BLANK: "Unknown product id shows a blank page"
  return !defects.FC_DETAIL_404_BLANK;
}

/** Whether an empty cart renders the empty message (otherwise only the title). */
export function showEmptyCartMessage(defects) {
  // FC_EMPTY_CART_BLANK: "Empty cart shows a blank page"
  return !defects.FC_EMPTY_CART_BLANK;
}

/** Stock text and state. kind: out | low | in. */
export function stockState(stock, defects) {
  if (stock <= 0) return { kind: 'out', text: "Sotuvda yo'q" };
  // FC_LOW_STOCK_AT_6: "Low-stock text shown for stock 6"
  const lowTo = defects.FC_LOW_STOCK_AT_6 ? 6 : 5;
  if (stock <= lowTo) return { kind: 'low', text: `Atigi ${stock} ta qoldi` };
  return { kind: 'in', text: 'Sotuvda bor' };
}

/** Button on a product card: Add to cart, or Notify me for an out-of-stock product. */
export function cardAction(stock, defects) {
  // FC_OOS_ADD_ENABLED: "Add to cart still possible on out-of-stock product"
  if (stock <= 0 && !defects.FC_OOS_ADD_ENABLED) return 'notify';
  return 'add';
}

/** Buttons on the detail page. */
export function detailActions(stock, defects) {
  const out = stock <= 0;
  // FC_OOS_ADD_ENABLED: Add to cart stays next to Notify me.
  return { add: !out || defects.FC_OOS_ADD_ENABLED, notify: out };
}
