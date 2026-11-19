import { cartStorageKind } from './rules.js';

export const CART_KEY = 'freshcart.cartId';

/** Pick local or session storage for the cart id depending on the build. */
export function pickStorage(defects, { local, session }) {
  return cartStorageKind(defects) === 'session' ? session : local;
}

/** Remembers the cart id in a Storage-like object (getItem, setItem, removeItem). */
export function createCartSession(storage) {
  return {
    get() {
      try {
        return storage.getItem(CART_KEY);
      } catch {
        return null;
      }
    },
    set(id) {
      try {
        storage.setItem(CART_KEY, id);
      } catch {
        /* storage blocked: the cart simply is not remembered */
      }
    },
    clear() {
      try {
        storage.removeItem(CART_KEY);
      } catch {
        /* nothing to clear */
      }
    },
  };
}
