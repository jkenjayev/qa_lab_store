import { randomUUID } from 'node:crypto';

/** Read-only product storage. */
export class InMemoryProductRepository {
  constructor(products) {
    this.products = products;
  }

  all() {
    return this.products;
  }

  byId(id) {
    return this.products.find((p) => p.id === id) ?? null;
  }
}

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

/** Guest carts, kept for 7 days from their last change (clock is injected). */
export class InMemoryCartRepository {
  constructor(clock) {
    this.clock = clock;
    this.carts = new Map();
  }

  create() {
    const now = this.clock.now().getTime();
    const cart = { id: randomUUID(), lines: [], promoCodes: [], delivery: null, seq: 1, updatedAt: now };
    this.carts.set(cart.id, cart);
    return cart;
  }

  get(id) {
    const cart = this.carts.get(id);
    if (!cart) return null;
    if (this.clock.now().getTime() - cart.updatedAt > SEVEN_DAYS_MS) {
      this.carts.delete(id);
      return null;
    }
    return cart;
  }

  save(cart) {
    const saved = { ...cart, updatedAt: this.clock.now().getTime() };
    this.carts.set(saved.id, saved);
    return saved;
  }
}

/** Orders; numbers are FC- followed by 6 digits, counting up from 100231. */
export class InMemoryOrderRepository {
  constructor(firstNumber = 100231) {
    this.firstNumber = firstNumber;
    this.orders = [];
  }

  nextNumber() {
    return `FC-${this.firstNumber + this.orders.length}`;
  }

  add(order) {
    this.orders.push(order);
    return order;
  }

  byNumber(number) {
    return this.orders.find((o) => o.number === number) ?? null;
  }

  all() {
    return [...this.orders];
  }
}
