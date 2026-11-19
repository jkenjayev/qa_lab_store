import { InMemoryCartRepository, InMemoryOrderRepository } from '../data/repositories.js';
import { cartRecord, orderRecord } from './records.js';

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

/** Carts kept in memory and written through to the FC Carts database. */
export class PersistentCartRepository extends InMemoryCartRepository {
  constructor(clock, store) {
    super(clock);
    this.store = store;
  }

  /** Put carts read from Notion into memory. Expired ones are archived instead. */
  hydrate(carts) {
    const now = this.clock.now().getTime();
    for (const cart of carts) {
      if (now - cart.updatedAt > SEVEN_DAYS_MS) this.store.archive(cart.id);
      else this.carts.set(cart.id, cart);
    }
  }

  #persist(cart) {
    const { key, data, summary } = cartRecord(cart);
    this.store.upsert(key, data, summary);
  }

  create() {
    const cart = super.create();
    this.#persist(cart);
    return cart;
  }

  get(id) {
    const known = this.carts.has(id);
    const cart = super.get(id);
    if (known && !cart) this.store.archive(id);
    return cart;
  }

  save(cart) {
    const saved = super.save(cart);
    this.#persist(saved);
    return saved;
  }
}

/** Orders kept in memory and written through to the FC Orders database. */
export class PersistentOrderRepository extends InMemoryOrderRepository {
  constructor(store, firstNumber) {
    super(firstNumber);
    this.store = store;
  }

  /** Put orders read from Notion into memory in number order so numbering continues. */
  hydrate(orders) {
    this.orders = [...orders].sort((a, b) => a.number.localeCompare(b.number));
  }

  add(order) {
    const added = super.add(order);
    const { key, data, summary } = orderRecord(added);
    this.store.upsert(key, data, summary);
    return added;
  }
}
