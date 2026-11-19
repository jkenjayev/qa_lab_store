import { ConflictError, NotFoundError, PaymentDeclinedError, ValidationError } from '../domain/errors.js';
import { buildDays, findSlot } from '../domain/delivery.js';
import { toLocalIso } from '../clock.js';
import { validateCard, validateDelivery } from '../shared/validation.js';

/**
 * Checkout use cases: delivery step, payment, orders.
 * Collaborators are injected: cart service, order repository, payment gateway, clock.
 */
export class CheckoutService {
  #booked = new Map();
  #inFlight = new Set();

  constructor({ cartService, orderRepo, gateway, clock, defects }) {
    this.cartService = cartService;
    this.orderRepo = orderRepo;
    this.gateway = gateway;
    this.clock = clock;
    this.defects = defects;
  }

  slots() {
    return buildDays(this.clock.now(), {
      defects: this.defects,
      booked: (id) => this.#booked.get(id) ?? 0,
    });
  }

  setDelivery(cartId, fields) {
    const cart = this.cartService.getOrCreate(cartId);
    if (!cart.lines.length) throw new ConflictError("Savatingiz bo'sh");

    const errors = validateDelivery(fields, this.defects);
    if (!fields.slotId) errors.slotId = 'Yetkazib berish vaqtini tanlang';
    if (Object.keys(errors).length) throw new ValidationError("Belgilangan maydonlarni to'g'rilang", errors);

    const found = findSlot(this.slots(), fields.slotId);
    if (!found || !found.slot.selectable) throw new ConflictError("Bu yetkazib berish vaqti band");

    return this.cartService.setDelivery(cart.id, {
      fullName: fields.fullName.trim(),
      phone: String(fields.phone).trim(),
      street: fields.street.trim(),
      city: fields.city.trim(),
      zip: String(fields.zip).trim(),
      slotId: found.slot.id,
      slotLabel: `${found.day.label}, ${found.slot.label}`,
    });
  }

  async pay(cartId, card) {
    const cart = this.cartService.getOrCreate(cartId);
    if (!cart.lines.length) throw new ConflictError("Savatingiz bo'sh");
    if (!cart.delivery) throw new ConflictError('Avval yetkazib berish vaqtini tanlang');

    const errors = validateCard(card, this.defects, this.clock.now());
    if (Object.keys(errors).length) throw new ValidationError("Belgilangan maydonlarni to'g'rilang", errors);

    // FC_DOUBLE_SUBMIT_TWO_ORDERS: "Double click on Place order creates two orders" - the reference
    // build refuses a second payment while the first is processing and empties the cart on success.
    const guard = !this.defects.FC_DOUBLE_SUBMIT_TWO_ORDERS;
    if (guard) {
      if (this.#inFlight.has(cart.id)) throw new ConflictError("To'lovingiz allaqachon amalga oshirilmoqda");
      this.#inFlight.add(cart.id);
    }
    try {
      const view = this.cartService.view(cart);
      const result = await this.gateway.charge({ number: card.number, amountCents: view.totals.totalCents });
      if (!result.approved) throw new PaymentDeclinedError();

      const order = this.orderRepo.add({
        number: this.orderRepo.nextNumber(),
        createdAt: toLocalIso(this.clock.now()),
        lines: view.lines.map(({ name, quantity, unitPriceCents, lineTotalCents }) => ({
          name,
          quantity,
          unitPriceCents,
          lineTotalCents,
        })),
        totals: view.totals,
        delivery: cart.delivery,
        last4: result.last4,
      });
      this.#booked.set(cart.delivery.slotId, (this.#booked.get(cart.delivery.slotId) ?? 0) + 1);
      if (guard) this.cartService.clear(cart.id);
      return order;
    } finally {
      this.#inFlight.delete(cart.id);
    }
  }

  getOrder(number) {
    const order = this.orderRepo.byNumber(number);
    if (!order) throw new NotFoundError('Buyurtma topilmadi');
    return order;
  }

  listOrders() {
    return this.orderRepo.all();
  }
}
