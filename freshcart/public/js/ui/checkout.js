import { esc } from '../html.js';
import { formatCountdown, formatPrice } from '../format.js';

export function renderProgress(step) {
  const steps = [
    ['cart', '1', 'Savat'],
    ['delivery', '2', 'Yetkazib berish'],
    ['payment', '3', "To'lov"],
  ];
  const order = steps.map((s) => s[0]);
  const items = steps
    .map(([key, n, label]) => {
      const state = order.indexOf(key) < order.indexOf(step) ? 'done' : key === step ? 'current' : 'todo';
      return `<li class="step step-${state}"${state === 'current' ? ' aria-current="step"' : ''}>(${state === 'done' ? '&#10003;' : n}) ${label}</li>`;
    })
    .join('');
  return `<ol class="progress">${items}</ol>`;
}

const field = (id, label, value, errors, attrs = '') => `
<div class="field">
  <label for="${id}">${label}</label>
  <input id="${id}" name="${id}" type="text" value="${esc(value ?? '')}" ${attrs}>
  <p class="field-error" data-error-for="${id}" role="alert">${esc(errors[id] ?? '')}</p>
</div>`;

function renderSlotGrid(days, selectedSlot) {
  const head = days.map((d) => `<th scope="col">${esc(d.label)}</th>`).join('');
  const rows = (days[0]?.slots ?? [])
    .map((_, i) => {
      const cells = days
        .map((day) => {
          const slot = day.slots[i];
          const text = slot.full ? "To'lgan" : slot.selectable ? `${slot.remaining} ta qoldi` : 'Yopiq';
          const cls = ['slot', slot.id === selectedSlot ? 'selected' : '', slot.full ? 'is-full' : ''].join(' ').trim();
          return `<td><button type="button" class="${cls}" data-slot="${slot.id}"${slot.selectable ? '' : ' disabled'}>${text}</button></td>`;
        })
        .join('');
      return `<tr><th scope="row">${days[0].slots[i].label}</th>${cells}</tr>`;
    })
    .join('');
  return `<table class="slots"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

/** Checkout step 2: address fields and delivery slot picker. */
export function renderDelivery({ form, errors, days, selectedSlot, holdSeconds, canContinue, serverError, ctx }) {
  const hold = ctx.features.holdCountdown
    ? `<p class="hold" id="hold"${selectedSlot ? '' : ' hidden'}>Vaqt ushlab turilmoqda: ${formatCountdown(holdSeconds)}</p>`
    : '';
  return `
${renderProgress('delivery')}
<h1>Yetkazib berish</h1>
<form id="delivery-form" novalidate>
  <div class="form-grid">
    ${field('fullName', "To'liq ism", form.fullName, errors)}
    ${field('phone', 'Telefon', form.phone, errors, 'inputmode="tel" placeholder="(555) 010-1234"')}
    ${field('street', "Ko'cha manzili", form.street, errors)}
    ${field('city', 'Shahar', form.city, errors)}
    ${field('zip', 'Pochta indeksi (ZIP)', form.zip, errors)}
  </div>
  <h2>Yetkazib berish vaqtini tanlang</h2>
  ${hold}
  ${renderSlotGrid(days, selectedSlot)}
  <p class="field-error" id="server-error" role="alert">${esc(serverError ?? '')}</p>
  <div class="form-actions">
    <a class="btn btn-secondary" href="/cart" data-link>Orqaga</a>
    <button type="submit" class="btn" id="continue"${canContinue ? '' : ' disabled'}>Davom etish</button>
  </div>
</form>`;
}

/** Checkout step 3: payment. The provider is a mock until the sandbox keys arrive. */
export function renderPayment({ form, errors, totalCents, canPlace, serverError }) {
  return `
${renderProgress('payment')}
<h1>To'lov</h1>
<form id="payment-form" novalidate>
  <div class="form-grid">
    ${field('number', 'Karta raqami', form.number, errors, 'inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242"')}
    ${field('expiry', 'Amal qilish muddati (MM/YY)', form.expiry, errors, 'autocomplete="cc-exp" placeholder="08/29"')}
    ${field('cvc', 'CVC', form.cvc, errors, 'inputmode="numeric" autocomplete="cc-csc"')}
    ${field('name', "Karta egasining ismi", form.name, errors, 'autocomplete="cc-name"')}
  </div>
  <p class="pay-total">To'lanadigan summa: <strong>${formatPrice(totalCents)}</strong></p>
  <p class="field-error" id="server-error" role="alert">${esc(serverError ?? '')}</p>
  <div class="form-actions">
    <a class="btn btn-secondary" href="/checkout/delivery" data-link>Orqaga</a>
    <button type="submit" class="btn" id="place-order"${canPlace ? '' : ' disabled'}>Buyurtma berish</button>
  </div>
</form>`;
}

export function renderConfirmation(order) {
  const items = order.lines
    .map((l) => `<li>${esc(l.name)} x${l.quantity} <span>${formatPrice(l.lineTotalCents)}</span></li>`)
    .join('');
  const d = order.delivery;
  return `
<section class="confirmation">
  <h1>Buyurtmangiz uchun rahmat</h1>
  <p class="order-number">Buyurtma raqami: <strong id="order-number">${esc(order.number)}</strong></p>
  <ul class="order-items">${items}</ul>
  <p>Jami: <strong>${formatPrice(order.totals.totalCents)}</strong></p>
  <p>Yetkazib berish vaqti: ${esc(d.slotLabel)}</p>
  <p>Manzil: ${esc(d.fullName)}, ${esc(d.street)}, ${esc(d.city)} ${esc(d.zip)}</p>
  <a class="btn" href="/products" data-link>Xaridni davom ettirish</a>
</section>`;
}

/** Internal mock order list (no design: a training helper). */
export function renderOrders(orders) {
  if (orders.length === 0) return '<h1>Sinov buyurtmalari</h1><p class="empty">Hozircha buyurtma yo\'q</p>';
  const rows = orders
    .map((o) => `<tr><td>${esc(o.number)}</td><td>${esc(o.delivery.slotLabel)}</td><td>${formatPrice(o.totals.totalCents)}</td></tr>`)
    .join('');
  return `<h1>Sinov buyurtmalari</h1><table class="orders"><thead><tr><th>Buyurtma</th><th>Vaqt</th><th>Jami</th></tr></thead><tbody>${rows}</tbody></table>`;
}
