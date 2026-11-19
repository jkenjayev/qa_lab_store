import { ValidationError } from './errors.js';

/** Most units of one product in a cart. */
export function maxQuantity(defects) {
  // FC_CART_LIMIT_100: "Quantity limit is 100, not 99"
  return defects.FC_CART_LIMIT_100 ? 100 : 99;
}

export function assertQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ValidationError("Miqdor kamida 1 bo'lgan butun son bo'lishi kerak");
  }
}

/**
 * Add units of a product. Returns the new lines and whether the limit cut the quantity.
 * `newLineId` is injected so the function stays pure.
 */
export function addToLines(lines, productId, quantity, { defects, newLineId }) {
  const limit = maxQuantity(defects);
  // FC_CART_DUPLICATE_LINE: "Same product creates a duplicate cart line" - the merge
  // only happens when the existing line already holds more than 1 unit.
  const existing = lines.find(
    (l) => l.productId === productId && (!defects.FC_CART_DUPLICATE_LINE || l.quantity > 1),
  );
  if (existing) {
    const wanted = existing.quantity + quantity;
    return {
      lines: lines.map((l) => (l === existing ? { ...l, quantity: Math.min(wanted, limit) } : l)),
      limitReached: wanted > limit,
    };
  }
  return {
    lines: [...lines, { lineId: newLineId(), productId, quantity: Math.min(quantity, limit) }],
    limitReached: quantity > limit,
  };
}

/** Set the units of one line (stepper). Minimum 1; use removeLine to drop a line. */
export function setLineQuantity(lines, lineId, quantity, defects) {
  assertQuantity(quantity);
  const limit = maxQuantity(defects);
  return {
    lines: lines.map((l) => (l.lineId === lineId ? { ...l, quantity: Math.min(quantity, limit) } : l)),
    limitReached: quantity > limit,
  };
}

export function removeLine(lines, lineId) {
  return lines.filter((l) => l.lineId !== lineId);
}
