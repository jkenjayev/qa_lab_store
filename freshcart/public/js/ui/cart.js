import { esc } from '../html.js';
import { formatPrice } from '../format.js';
import { showEmptyCartMessage } from '../rules.js';

/** Mini-cart: at most 3 rows, then "+N more items", then the subtotal. */
export function renderMiniCart(cart) {
  if (cart.lines.length === 0) return '<p class="empty">Savatingiz bo\'sh</p>';
  const rows = cart.lines
    .slice(0, 3)
    .map(
      (l) =>
        `<li><span class="mc-name">${esc(l.name)}</span> <span class="mc-qty">x${l.quantity}</span> <span class="mc-total">${formatPrice(l.lineTotalCents)}</span></li>`,
    )
    .join('');
  const more = cart.lines.length > 3 ? `<p class="mc-more">+${cart.lines.length - 3} ta mahsulot yana</p>` : '';
  return `<ul class="mc-list">${rows}</ul>${more}
<p class="mc-subtotal"><span>Oraliq jami</span> <span>${formatPrice(cart.totals.subtotalCents)}</span></p>
<a class="btn" href="/cart" data-link>Savatni ko'rish</a>`;
}

function renderLine(line, limit) {
  return `
<li class="cart-line" data-line="${line.lineId}">
  <img src="/img/${line.productId}/1.svg" alt="" width="64" height="64">
  <a class="cl-name" href="/products/${line.productId}" data-link>${esc(line.name)}</a>
  <span class="cl-unit">${formatPrice(line.unitPriceCents)}</span>
  <span class="stepper">
    <button type="button" data-qty-minus="${line.lineId}" aria-label="${esc(line.name)} miqdorini kamaytirish"${line.quantity <= 1 ? ' disabled' : ''}>-</button>
    <input class="qty-input" type="number" min="1" max="${limit}" value="${line.quantity}" data-qty-input="${line.lineId}" aria-label="${esc(line.name)} miqdori">
    <button type="button" data-qty-plus="${line.lineId}" aria-label="${esc(line.name)} miqdorini oshirish"${line.quantity >= limit ? ' disabled' : ''}>+</button>
  </span>
  <span class="cl-total">${formatPrice(line.lineTotalCents)}</span>
  <button type="button" class="link-btn" data-remove-line="${line.lineId}">Olib tashlash</button>
</li>`;
}

function renderSummary(cart, { promoError, ctx }) {
  const t = cart.totals;
  const discount = t.discountCents > 0 ? `<tr><th>Chegirma</th><td>-${formatPrice(t.discountCents)}</td></tr>` : '';
  const removeButton =
    ctx.features.promoRemove && cart.promoCodes.length
      ? '<button type="button" class="link-btn" id="promo-remove">Olib tashlash</button>'
      : '';
  return `
<aside class="summary">
  <h2>Buyurtma xulosasi</h2>
  <div class="promo">
    <label for="promo-input">Promokod</label>
    <div class="promo-row"><input id="promo-input" type="text" autocomplete="off"><button type="button" class="btn" id="promo-apply">Qo'llash</button></div>
    <p class="promo-ok" id="promo-ok">${esc(cart.promoMessage)}${cart.promoMessage ? ` ${removeButton}` : ''}</p>
    <p class="field-error" id="promo-error" role="alert">${esc(promoError ?? '')}</p>
  </div>
  <table class="totals">
    <tr><th>Oraliq jami</th><td>${formatPrice(t.subtotalCents)}</td></tr>
    ${discount}
    <tr><th>Yetkazib berish</th><td>${formatPrice(t.deliveryCents)}</td></tr>
    <tr><th>Soliq (8%)</th><td>${formatPrice(t.taxCents)}</td></tr>
    <tr class="grand"><th>Jami</th><td>${formatPrice(t.totalCents)}</td></tr>
  </table>
  <a class="btn btn-block" id="checkout-link" href="/checkout/delivery" data-link>Rasmiylashtirish</a>
</aside>`;
}

export function renderCartPage({ cart, promoError, ctx }) {
  if (cart.lines.length === 0) {
    // FC_EMPTY_CART_BLANK: "Empty cart shows a blank page" - only the title is rendered.
    const message = showEmptyCartMessage(ctx.defects)
      ? '<p class="empty">Savatingiz bo\'sh</p><a class="btn" href="/products" data-link>Xaridni davom ettirish</a>'
      : '';
    return `<h1>Savatingiz</h1>${message}`;
  }
  return `
<h1>Savatingiz</h1>
<div class="cart-layout">
  <ul class="cart-lines">${cart.lines.map((l) => renderLine(l, cart.limit)).join('')}</ul>
  ${renderSummary(cart, { promoError, ctx })}
</div>`;
}
