import { addToLines, assertQuantity, maxQuantity, removeLine, setLineQuantity } from '../domain/cart.js';
import { ConflictError, NotFoundError } from '../domain/errors.js';
import { computeTotals } from '../domain/pricing.js';
import { PROMOS } from '../data/promos.js';
import { applyPromo } from '../domain/promo.js';

/** Cart use cases. Depends on cart and product repository interfaces and the pricing rules. */
export class CartService {
  constructor({ cartRepo, productRepo, defects, features, promos = PROMOS }) {
    this.cartRepo = cartRepo;
    this.productRepo = productRepo;
    this.defects = defects;
    this.features = features;
    this.promos = promos;
  }

  /** The cart for an id sent by the browser, or a new one when it is missing or expired. */
  getOrCreate(cartId) {
    return (cartId && this.cartRepo.get(cartId)) || this.cartRepo.create();
  }

  /** The cart as the browser sees it: priced lines, totals, promo state and limits. */
  view(cart, extra = {}) {
    const lines = cart.lines
      .map((line) => {
        const product = this.productRepo.byId(line.productId);
        if (!product) return null;
        return {
          lineId: line.lineId,
          productId: product.id,
          name: product.name,
          unitPriceCents: product.priceCents,
          quantity: line.quantity,
          lineTotalCents: product.priceCents * line.quantity,
          imageCount: product.imageCount,
        };
      })
      .filter(Boolean);
    const totals = computeTotals({
      lines,
      promoCodes: cart.promoCodes,
      defects: this.defects,
      features: this.features,
      promos: this.promos,
    });
    return {
      cartId: cart.id,
      lines,
      totals,
      promoCodes: cart.promoCodes,
      promoMessage: cart.promoCodes.length ? `Promokod qo'llandi: ${cart.promoCodes.join(', ')}` : '',
      delivery: cart.delivery,
      limit: maxQuantity(this.defects),
      ...extra,
    };
  }

  get(cartId) {
    return this.view(this.getOrCreate(cartId));
  }

  addItem(cartId, productId, quantity = 1) {
    assertQuantity(quantity);
    const product = this.productRepo.byId(Number(productId));
    if (!product) throw new NotFoundError('Mahsulot topilmadi');
    // FC_OOS_ADD_ENABLED: "Add to cart still possible on out-of-stock product"
    if (product.stock <= 0 && !this.defects.FC_OOS_ADD_ENABLED) {
      throw new ConflictError("Bu mahsulot sotuvda yo'q");
    }
    const cart = this.getOrCreate(cartId);
    let seq = cart.seq;
    const { lines, limitReached } = addToLines(cart.lines, product.id, quantity, {
      defects: this.defects,
      newLineId: () => `L${seq++}`,
    });
    return this.view(this.cartRepo.save({ ...cart, lines, seq }), { limitReached });
  }

  setQuantity(cartId, lineId, quantity) {
    const cart = this.getOrCreate(cartId);
    if (!cart.lines.some((l) => l.lineId === lineId)) throw new NotFoundError('Savat qatori topilmadi');
    const { lines, limitReached } = setLineQuantity(cart.lines, lineId, quantity, this.defects);
    return this.view(this.cartRepo.save({ ...cart, lines }), { limitReached });
  }

  remove(cartId, lineId) {
    const cart = this.getOrCreate(cartId);
    if (!cart.lines.some((l) => l.lineId === lineId)) throw new NotFoundError('Savat qatori topilmadi');
    return this.view(this.cartRepo.save({ ...cart, lines: removeLine(cart.lines, lineId) }));
  }

  applyPromo(cartId, code) {
    const cart = this.getOrCreate(cartId);
    const subtotal = this.view(cart).totals.subtotalCents;
    const promoCodes = applyPromo(cart.promoCodes, code, subtotal, this.defects, this.promos);
    return this.view(this.cartRepo.save({ ...cart, promoCodes }));
  }

  removePromo(cartId) {
    const cart = this.getOrCreate(cartId);
    return this.view(this.cartRepo.save({ ...cart, promoCodes: [] }));
  }

  clear(cartId) {
    const cart = this.getOrCreate(cartId);
    return this.view(this.cartRepo.save({ ...cart, lines: [], promoCodes: [], delivery: null }));
  }

  /** Store the delivery details chosen at checkout step 2. */
  setDelivery(cartId, delivery) {
    const cart = this.getOrCreate(cartId);
    return this.view(this.cartRepo.save({ ...cart, delivery }));
  }
}
