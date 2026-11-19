import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PRODUCTS } from '../src/data/products.js';
import { renderCartPage, renderMiniCart } from '../public/js/ui/cart.js';
import {
  renderChips, renderDetail, renderFilters, renderGrid, renderListingPage, renderNotifyDialog,
  renderPagination, renderProductCard, renderProductNotFound, renderSearchPage, renderSortSelect,
} from '../public/js/ui/catalog.js';
import {
  highlight, renderCartBadge, renderHeaderShell, renderPageNotFound, renderSuggestions, resultsHeadingHtml,
} from '../public/js/ui/chrome.js';
import {
  renderConfirmation, renderDelivery, renderOrders, renderPayment, renderProgress,
} from '../public/js/ui/checkout.js';
import { COMPLETE, OFF, ON, PARTIAL } from './helpers.js';

const train = { defects: ON, features: PARTIAL };
const ref = { defects: OFF, features: COMPLETE };
const product = (id) => PRODUCTS.find((p) => p.id === id);
const line = (n, qty = 1, price = 200) => ({
  lineId: `L${n}`, productId: 19, name: `Item ${n}`, unitPriceCents: price, quantity: qty, lineTotalCents: price * qty,
});
const totals = { subtotalCents: 600, discountCents: 0, deliveryCents: 400, taxCents: 80, totalCents: 1080 };
const cartOf = (lines, over = {}) => ({ lines, totals, promoCodes: [], promoMessage: '', limit: 99, delivery: null, ...over });

describe('chrome', () => {
  it('highlights the match in bold and escapes everything', () => {
    assert.equal(highlight('Sut, to\'liq yog\'li 1 l', 'sut'), '<b>Sut</b>, to&#39;liq yog&#39;li 1 l');
    assert.equal(highlight('A <b> C', 'zzz'), 'A &lt;b&gt; C');
    assert.equal(highlight('Plain', ''), 'Plain');
  });

  it('FC_SEARCH_XSS_HEADING on: the term goes into the heading as HTML', () => {
    assert.equal(resultsHeadingHtml('<b>test</b>', ON), '"<b>test</b>" bo\'yicha natijalar');
  });

  it('FC_SEARCH_XSS_HEADING off: the term is escaped', () => {
    assert.equal(resultsHeadingHtml('<b>test</b>', OFF), '"&lt;b&gt;test&lt;/b&gt;" bo\'yicha natijalar');
  });

  it('FC_SEARCH_NO_MAXLENGTH: maxlength 50 only in the reference header', () => {
    assert.doesNotMatch(renderHeaderShell({ defects: ON }), /maxlength/);
    assert.match(renderHeaderShell({ defects: OFF, term: 'milk' }), /maxlength="50"/);
    assert.match(renderHeaderShell({ defects: OFF, term: 'milk' }), /value="milk"/);
  });

  it('renders the cart badge, suggestions and the 404 page', () => {
    assert.equal(renderCartBadge({ lines: [{ quantity: 3 }] }, ON), '1');
    assert.equal(renderCartBadge({ lines: [{ quantity: 3 }] }, OFF), '3');
    const html = renderSuggestions([{ id: 8, name: 'Sut, jo\'xori 1 l' }], 'sut');
    assert.match(html, /<b>Sut<\/b>, jo&#39;xori 1 l/);
    assert.match(html, /href="\/search\?q=Sut%2C%20jo'xori%201%20l"/);
    assert.match(renderPageNotFound(), /Sahifa topilmadi/);
  });
});

describe('catalog views', () => {
  it('FC_PRICE_ONE_DECIMAL: the card price', () => {
    assert.match(renderProductCard(product(11), train), />\$3\.5</);
    assert.match(renderProductCard(product(11), ref), />\$3\.50</);
  });

  it('shows the out-of-stock badge and the action of the build', () => {
    const milk = product(12);
    const training = renderProductCard(milk, train);
    assert.match(training, /badge-out/);
    assert.match(training, /data-add="12"/);
    const reference = renderProductCard(milk, ref);
    assert.match(reference, /data-notify="12"/);
    assert.doesNotMatch(reference, /data-add/);
  });

  it('FC_LOW_STOCK_AT_6: Only N left on the card', () => {
    assert.match(renderProductCard(product(11), train), /Atigi 3 ta qoldi/);
    assert.match(renderProductCard(product(13), train), /Atigi 6 ta qoldi/);
    assert.doesNotMatch(renderProductCard(product(13), ref), /Atigi/);
    assert.match(renderProductCard(product(11), ref), /Atigi 3 ta qoldi/);
  });

  it('renders a grid or the empty text', () => {
    assert.match(renderGrid([product(1), product(2)], ref), /class="grid"/);
    assert.match(renderGrid([], ref), /Mahsulotlar topilmadi/);
    assert.equal(renderGrid([], ref, 'X'), 'X');
  });

  it('pagination disables Previous on the first and Next on the last page and hides when empty', () => {
    const first = renderPagination({ page: 1, pageCount: 4, total: 48 });
    assert.match(first, /data-page="0" disabled/);
    assert.doesNotMatch(first, /data-page="2" disabled/);
    const last = renderPagination({ page: 4, pageCount: 4, total: 48 });
    assert.match(last, /data-page="5" disabled/);
    assert.match(last, /aria-current="page"/);
    assert.equal(renderPagination({ page: 1, pageCount: 0, total: 0 }), '');
  });

  it('renders the sort select with the three options', () => {
    const html = renderSortSelect('price-asc');
    assert.match(html, /value="price-asc" selected/);
    assert.match(html, /Narx: qimmatdan arzonga/);
  });

  it('renders the filters and keeps the chosen values', () => {
    const categories = [{ slug: 'dairy', name: 'Dairy', count: 9 }, { slug: 'bakery', name: 'Bakery', count: 7 }];
    const html = renderFilters({ categories, state: { category: 'dairy', min: '2', max: '10' }, priceError: 'Minimal narx maksimal narxdan oshmasligi kerak' });
    assert.match(html, /value="dairy" checked/);
    assert.match(html, /Barchasi <span class="count">\(16\)/);
    assert.match(html, /value="2"/);
    assert.match(html, /Minimal narx maksimal narxdan oshmasligi kerak/);
  });

  it('active filter chips exist only in the reference build', () => {
    const categories = [{ slug: 'dairy', name: 'Dairy', count: 9 }];
    const state = { category: 'dairy', min: '2', max: '10' };
    assert.equal(renderChips({ state, categories, ctx: train }), '');
    const chips = renderChips({ state, categories, ctx: ref });
    assert.match(chips, /Dairy/);
    assert.match(chips, /\$2 - \$10/);
    assert.equal(renderChips({ state: {}, categories, ctx: ref }), '');
    assert.match(renderChips({ state: { max: '5' }, categories, ctx: ref }), /\$0 - \$5/);
    assert.match(renderChips({ state: { min: '5' }, categories, ctx: ref }), /\$5 - \$999\+/);
  });

  it('renders the listing page with the product count, and the mobile Filters button only in the reference build', () => {
    const data = { items: [product(1)], total: 48, page: 1, pageCount: 4 };
    const args = { data, categories: [], state: { sort: 'name-asc' } };
    const training = renderListingPage({ ...args, ctx: train });
    assert.match(training, /Mahsulotlar \(48\)/);
    assert.doesNotMatch(training, /filters-toggle/);
    assert.match(renderListingPage({ ...args, ctx: ref }), /filters-toggle/);
  });

  it('renders the search page with the heading and the empty message', () => {
    const data = { items: [], total: 0, page: 1, pageCount: 0 };
    const html = renderSearchPage({ term: 'milk', data, state: { sort: 'name-asc' }, ctx: train });
    assert.match(html, /"milk" bo'yicha mahsulot topilmadi\. Boshqa so'z kiriting\./);
    assert.match(html, /<h1 id="results-heading">"milk" bo'yicha natijalar<\/h1>/);
    const xss = renderSearchPage({ term: '<b>x</b>', data, state: { sort: 'name-asc' }, ctx: train });
    assert.match(xss, /<h1 id="results-heading">"<b>x<\/b>" bo'yicha natijalar<\/h1>/);
    assert.match(xss, /"&lt;b&gt;x&lt;\/b&gt;" bo'yicha mahsulot topilmadi/);
  });

  it('FC_DETAIL_THREE_IMAGES: 3 thumbnails vs 4', () => {
    const milk = product(12);
    assert.equal((renderDetail({ product: milk, categoryName: 'Dairy', qty: 1, ctx: train }).match(/class="thumb"/g) ?? []).length, 3);
    assert.equal((renderDetail({ product: milk, categoryName: 'Dairy', qty: 1, ctx: ref }).match(/class="thumb"/g) ?? []).length, 4);
  });

  it('FC_STEPPER_MAX_11: plus is disabled at the maximum', () => {
    const p = product(19);
    assert.doesNotMatch(renderDetail({ product: p, categoryName: 'Fruit', qty: 10, ctx: train }), /id="qty-plus"[^>]*disabled/);
    assert.match(renderDetail({ product: p, categoryName: 'Fruit', qty: 11, ctx: train }), /id="qty-plus"[^>]*disabled/);
    assert.match(renderDetail({ product: p, categoryName: 'Fruit', qty: 10, ctx: ref }), /id="qty-plus"[^>]*disabled/);
    assert.match(renderDetail({ product: p, categoryName: 'Fruit', qty: 1, ctx: ref }), /id="qty-minus"[^>]*disabled/);
  });

  it('detail page stock line, buttons and breadcrumb differ by build', () => {
    const milk = product(12);
    const training = renderDetail({ product: milk, categoryName: 'Dairy', qty: 1, ctx: train });
    assert.match(training, /stock-out">Sotuvda yo&#39;q/);
    assert.match(training, /id="add-to-cart"/);
    assert.match(training, /data-notify="12"/);
    assert.doesNotMatch(training, /breadcrumb/);
    const reference = renderDetail({ product: milk, categoryName: 'Dairy', qty: 1, ctx: ref });
    assert.doesNotMatch(reference, /id="add-to-cart"/);
    assert.match(reference, /data-notify="12"/);
    assert.match(reference, /class="breadcrumb"[^]*Bosh sahifa[^]*Dairy[^]*Sut, to&#39;liq yog&#39;li 1 l/);
    assert.match(renderDetail({ product: product(11), categoryName: 'Dairy', qty: 1, ctx: train }), /Atigi 3 ta qoldi/);
  });

  it('renders the not found page and the notify dialog', () => {
    assert.match(renderProductNotFound(), /Mahsulot topilmadi[^]*Mahsulotlarga qaytish/);
    const dialog = renderNotifyDialog({ productName: 'Sut, to\'liq yog\'li 1 l', error: 'To\'g\'ri email manzilini kiriting' });
    assert.match(dialog, /Mahsulot qaytganda xabar bering/);
    assert.match(dialog, /To&#39;g&#39;ri email manzilini kiriting/);
  });
});

describe('cart views', () => {
  it('mini-cart lists 3 rows then +N more items and the subtotal', () => {
    const html = renderMiniCart(cartOf([1, 2, 3, 4, 5].map((n) => line(n))));
    assert.equal((html.match(/<li>/g) ?? []).length, 3);
    assert.match(html, /\+2 ta mahsulot yana/);
    assert.match(html, /Oraliq jami/);
    assert.match(renderMiniCart(cartOf([])), /Savatingiz bo'sh/);
    assert.doesNotMatch(renderMiniCart(cartOf([line(1)])), /ta mahsulot yana/);
  });

  it('FC_EMPTY_CART_BLANK on: an empty cart shows only the title', () => {
    assert.equal(renderCartPage({ cart: cartOf([]), ctx: train }), '<h1>Savatingiz</h1>');
  });

  it('FC_EMPTY_CART_BLANK off: an empty cart shows the message and Continue shopping', () => {
    const html = renderCartPage({ cart: cartOf([]), ctx: ref });
    assert.match(html, /Savatingiz bo'sh/);
    assert.match(html, /Xaridni davom ettirish/);
  });

  it('shows lines, steppers with the limit, the summary and a discount line', () => {
    const cart = cartOf([line(1, 2), line(2, 99)], {
      totals: { ...totals, discountCents: 400 },
      promoCodes: ['FRESH10'],
      promoMessage: 'Promokod qo\'llandi: FRESH10',
    });
    const html = renderCartPage({ cart, promoError: 'Promokod yaroqsiz', ctx: train });
    assert.match(html, /data-line="L1"/);
    assert.match(html, /max="99"/);
    assert.match(html, /data-qty-plus="L2"[^>]*disabled/);
    assert.match(html, /data-qty-minus="L1"/);
    assert.match(html, /Chegirma<\/th><td>-\$4\.00/);
    assert.match(html, /Promokod qo&#39;llandi: FRESH10/);
    assert.match(html, /Promokod yaroqsiz/);
    assert.match(html, /Soliq \(8%\)/);
    assert.doesNotMatch(html, /promo-remove/);
    assert.match(renderCartPage({ cart, ctx: ref }), /id="promo-remove"/);
    assert.doesNotMatch(renderCartPage({ cart: cartOf([line(1)]), ctx: ref }), /Chegirma/);
  });
});

describe('checkout views', () => {
  const days = [
    { date: '2026-11-19', label: 'Pa 19 Noy', slots: [
      { id: '2026-11-19T14', label: '14:00-16:00', remaining: 2, full: false, selectable: false },
      { id: '2026-11-19T16', label: '16:00-18:00', remaining: 3, full: false, selectable: true },
    ] },
    { date: '2026-11-20', label: 'Ju 20 Noy', slots: [
      { id: '2026-11-20T10', label: '10:00-12:00', remaining: 0, full: true, selectable: true },
      { id: '2026-11-20T12', label: '12:00-14:00', remaining: 4, full: false, selectable: true },
    ] },
  ];
  const form = { fullName: 'Amina', phone: '', street: '', city: '', zip: '' };

  it('renders the progress bar states', () => {
    const html = renderProgress('delivery');
    assert.match(html, /step-done[^>]*>[^<]*&#10003;/);
    assert.match(html, /step-current/);
    assert.match(html, /step-todo/);
  });

  it('delivery step: fields, errors, slot states, hold countdown and the Continue rule', () => {
    const html = renderDelivery({ form, errors: { phone: '10 xonali telefon raqamini kiriting' }, days, selectedSlot: '2026-11-19T16', holdSeconds: 581, canContinue: false, serverError: '', ctx: train });
    assert.match(html, /value="Amina"/);
    assert.match(html, /10 xonali telefon raqamini kiriting/);
    assert.match(html, /data-slot="2026-11-19T14" disabled>Yopiq/);
    assert.match(html, /class="slot selected"[^>]*data-slot="2026-11-19T16">3 ta qoldi/);
    assert.match(html, /is-full[^>]*data-slot="2026-11-20T10">To'lgan/);
    assert.doesNotMatch(html, /data-slot="2026-11-20T10"[^>]*disabled/);
    assert.match(html, /id="continue" disabled/);
    assert.doesNotMatch(html, /id="hold"/);
    const reference = renderDelivery({ form, errors: {}, days, selectedSlot: '2026-11-19T16', holdSeconds: 581, canContinue: true, serverError: 'x', ctx: ref });
    assert.match(reference, /Vaqt ushlab turilmoqda: 09:41/);
    assert.doesNotMatch(reference, /id="continue" disabled/);
    assert.match(renderDelivery({ form, errors: {}, days, selectedSlot: null, holdSeconds: 600, canContinue: false, ctx: ref }), /id="hold" hidden/);
    assert.match(renderDelivery({ form, errors: {}, days: [], selectedSlot: null, holdSeconds: 600, canContinue: false, ctx: ref }), /slots/);
  });

  it('payment step: total, errors and the Place order state', () => {
    const f = { number: '', expiry: '', cvc: '', name: '' };
    const html = renderPayment({ form: f, errors: { cvc: '3 yoki 4 xonali CVC kodini kiriting' }, totalCents: 3888, canPlace: false, serverError: 'To\'lov rad etildi. Boshqa kartani sinab ko\'ring.' });
    assert.match(html, /To'lanadigan summa: <strong>\$38\.88/);
    assert.match(html, /3 yoki 4 xonali CVC kodini kiriting/);
    assert.match(html, /id="place-order" disabled/);
    assert.match(html, /To&#39;lov rad etildi\. Boshqa kartani sinab ko&#39;ring\./);
    assert.doesNotMatch(renderPayment({ form: f, errors: {}, totalCents: 100, canPlace: true }), /id="place-order" disabled/);
  });

  it('confirmation shows the order number, items, total, slot and address', () => {
    const order = {
      number: 'FC-100231',
      lines: [{ name: 'Banan 1 kg', quantity: 2, lineTotalCents: 400 }],
      totals: { totalCents: 832 },
      delivery: { slotLabel: 'Ju 20 Noy, 12:00-14:00', fullName: 'Amina Test', street: '1 Test Street', city: 'Springfield', zip: '12345' },
    };
    const html = renderConfirmation(order);
    assert.match(html, /Buyurtma raqami: <strong id="order-number">FC-100231/);
    assert.match(html, /Banan 1 kg x2/);
    assert.match(html, /\$8\.32/);
    assert.match(html, /Ju 20 Noy, 12:00-14:00/);
    assert.match(html, /1 Test Street, Springfield 12345/);
  });

  it('mock order list', () => {
    assert.match(renderOrders([]), /Hozircha buyurtma yo'q/);
    const html = renderOrders([{ number: 'FC-100231', delivery: { slotLabel: 'Ju 20 Noy, 12:00-14:00' }, totals: { totalCents: 832 } }]);
    assert.match(html, /FC-100231/);
    assert.match(html, /\$8\.32/);
  });
});
