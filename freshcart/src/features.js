/**
 * Features that the Notion implementation pages list under "Not built yet".
 * The default (training) build leaves them out, exactly like the recorded walkthroughs.
 * The reference build (SEEDED_DEFECTS=off) has them, so that it satisfies every acceptance
 * criterion and design.
 */
export const FEATURE_IDS = Object.freeze([
  'filterChips', // F1.3 active filter chips
  'mobileFilters', // F1.3 mobile Filters panel
  'breadcrumb', // F1.4 breadcrumb
  'thumbnailSwap', // F1.4 click a thumbnail to change the large image
  'notifyMe', // F1.5 Notify me dialog, email validation and toast
  'promoRemove', // F2.3 Remove button for the promo code
  'discountBeforeTax', // F2.3 tax calculated after the discount
  'holdCountdown', // F2.4 slot hold countdown
]);

export function createFeatures(mode = 'on') {
  const complete = mode === 'off';
  return Object.freeze(Object.fromEntries(FEATURE_IDS.map((id) => [id, complete])));
}
