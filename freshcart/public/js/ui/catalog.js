import { esc } from '../html.js';
import { formatCardPrice, formatPrice } from '../format.js';
import { cardAction, detailActions, stepperMax, stockState, thumbnailCount } from '../rules.js';
import { resultsHeadingHtml } from './chrome.js';

const SORT_OPTIONS = [
  ['name-asc', 'Nomi A-Z'],
  ['price-asc', 'Narx: arzondan qimmatga'],
  ['price-desc', 'Narx: qimmatdan arzonga'],
];

export function renderProductCard(product, ctx) {
  const stock = stockState(product.stock, ctx.defects);
  const badge = stock.kind === 'out' ? '<span class="badge badge-out">Sotuvda yo\'q</span>' : '';
  const low = stock.kind === 'low' ? `<p class="stock stock-low">${esc(stock.text)}</p>` : '';
  const action =
    cardAction(product.stock, ctx.defects) === 'notify'
      ? `<button type="button" class="btn btn-secondary" data-notify="${product.id}">Menga xabar bering</button>`
      : `<button type="button" class="btn" data-add="${product.id}">Savatga qo'shish</button>`;
  return `
<article class="card" data-product-id="${product.id}">
  <a class="card-image" href="/products/${product.id}" data-link><img src="/img/${product.id}/1.svg" alt="" width="200" height="200">${badge}</a>
  <h3 class="card-name"><a href="/products/${product.id}" data-link>${esc(product.name)}</a></h3>
  <p class="card-price">${formatCardPrice(product.priceCents, ctx.defects)}</p>
  ${low}
  ${action}
</article>`;
}

export function renderGrid(items, ctx, emptyHtml = '<p class="empty">Mahsulotlar topilmadi</p>') {
  if (items.length === 0) return emptyHtml;
  return `<div class="grid">${items.map((p) => renderProductCard(p, ctx)).join('')}</div>`;
}

/** Pagination: hidden when there is nothing to page. Previous/Next are disabled at the ends. */
export function renderPagination({ page, pageCount, total }) {
  if (total === 0) return '';
  const numbers = Array.from({ length: pageCount }, (_, i) => i + 1)
    .map((n) => `<button type="button" data-page="${n}"${n === page ? ' class="current" aria-current="page"' : ''}>${n}</button>`)
    .join('');
  return `<nav class="pagination" aria-label="Sahifalash">
  <button type="button" data-page="${page - 1}"${page <= 1 ? ' disabled' : ''}>&lt; Oldingi</button>
  ${numbers}
  <button type="button" data-page="${page + 1}"${page >= pageCount ? ' disabled' : ''}>Keyingi &gt;</button>
</nav>`;
}

export function renderSortSelect(sort) {
  const options = SORT_OPTIONS.map(
    ([value, label]) => `<option value="${value}"${value === sort ? ' selected' : ''}>${label}</option>`,
  ).join('');
  return `<label class="sort">Saralash: <select id="sort">${options}</select></label>`;
}

/** Sidebar: categories with counts and the price filter. */
export function renderFilters({ categories, state, priceError }) {
  const all = categories.reduce((sum, c) => sum + c.count, 0);
  const radio = (slug, label, count) =>
    `<li><label><input type="radio" name="category" value="${slug}"${(state.category ?? '') === slug ? ' checked' : ''}> ${esc(label)} <span class="count">(${count})</span></label></li>`;
  return `
<h2>Kategoriyalar</h2>
<ul class="categories">${radio('', 'Barchasi', all)}${categories.map((c) => radio(c.slug, c.name, c.count)).join('')}</ul>
<h2>Narx (butun $)</h2>
<div class="price-filter">
  <label>Min <input id="price-min" type="number" min="0" max="999" value="${esc(state.min ?? '')}"></label>
  <label>Maks <input id="price-max" type="number" min="0" max="999" value="${esc(state.max ?? '')}"></label>
  <button type="button" id="price-apply" class="btn">Qo'llash</button>
  <p class="field-error" id="price-error" role="alert">${esc(priceError ?? '')}</p>
</div>
<button type="button" id="clear-all" class="link-btn">Hammasini tozalash</button>`;
}

/** Active filter chips (feature F1.3 AC5, built later). */
export function renderChips({ state, categories, ctx }) {
  if (!ctx.features.filterChips) return '';
  const chips = [];
  if (state.category) {
    const name = categories.find((c) => c.slug === state.category)?.name ?? state.category;
    chips.push(`<span class="chip">${esc(name)} <button type="button" data-remove-filter="category" aria-label="${esc(name)} filtrini olib tashlash">&times;</button></span>`);
  }
  if (state.min !== undefined || state.max !== undefined) {
    const label = `$${state.min ?? 0} - $${state.max ?? '999+'}`;
    chips.push(`<span class="chip">${esc(label)} <button type="button" data-remove-filter="price" aria-label="Narx filtrini olib tashlash">&times;</button></span>`);
  }
  return chips.length ? `<div class="chips" aria-label="Faol filtrlar">${chips.join('')}</div>` : '';
}

export function renderListingPage({ data, categories, state, priceError, ctx }) {
  const mobileButton = ctx.features.mobileFilters
    ? '<button type="button" id="filters-toggle" class="btn btn-secondary mobile-only">Filtrlar</button>'
    : '';
  return `
<div class="listing">
  ${mobileButton}
  <aside class="filters" id="filters">${renderFilters({ categories, state, priceError })}</aside>
  <section class="listing-main">
    ${renderChips({ state, categories, ctx })}
    <div class="listing-head"><h1>Mahsulotlar (${data.total})</h1>${renderSortSelect(state.sort)}</div>
    ${renderGrid(data.items, ctx)}
    ${renderPagination(data)}
  </section>
</div>`;
}

export function renderSearchPage({ term, data, state, ctx }) {
  const empty = `<p class="empty">"${esc(term)}" bo'yicha mahsulot topilmadi. Boshqa so'z kiriting.</p>`;
  return `
<section class="listing-main search-results">
  <div class="listing-head"><h1 id="results-heading">${resultsHeadingHtml(term, ctx.defects)}</h1>${renderSortSelect(state.sort)}</div>
  ${renderGrid(data.items, ctx, empty)}
  ${renderPagination(data)}
</section>`;
}

export function renderProductNotFound() {
  return `<div class="not-found"><h1>Mahsulot topilmadi</h1><a href="/products" data-link>Mahsulotlarga qaytish</a></div>`;
}

export function renderDetail({ product, categoryName, qty, ctx }) {
  const stock = stockState(product.stock, ctx.defects);
  const actions = detailActions(product.stock, ctx.defects);
  const max = stepperMax(ctx.defects);
  const thumbs = Array.from({ length: thumbnailCount(product.imageCount, ctx.defects) }, (_, i) => i + 1)
    .map((n) => `<img class="thumb" data-image="${n}" src="/img/${product.id}/${n}.svg" alt="${esc(product.name)}, ${n}-rasm" width="64" height="64">`)
    .join('');
  const breadcrumb = ctx.features.breadcrumb
    ? `<nav class="breadcrumb" aria-label="Navigatsiya yo'li"><a href="/products" data-link>Bosh sahifa</a> &gt; <a href="/products?category=${esc(product.category)}" data-link>${esc(categoryName)}</a> &gt; ${esc(product.name)}</nav>`
    : '';
  return `
${breadcrumb}
<article class="detail">
  <div class="detail-media">
    <img id="main-image" class="main-image" src="/img/${product.id}/1.svg" alt="${esc(product.name)}" width="360" height="360">
    <div class="thumbs">${thumbs}</div>
  </div>
  <div class="detail-info">
    <h1>${esc(product.name)}</h1>
    <p class="price">${formatPrice(product.priceCents)} <span class="unit">${esc(product.unit)}</span></p>
    <p class="stock stock-${stock.kind}">${esc(stock.text)}</p>
    <p class="description">${esc(product.description)}</p>
    <div class="stepper" aria-label="Miqdor">
      <button type="button" id="qty-minus" aria-label="Miqdorni kamaytirish"${qty <= 1 ? ' disabled' : ''}>-</button>
      <span id="qty-value" aria-live="polite">${qty}</span>
      <button type="button" id="qty-plus" aria-label="Miqdorni oshirish"${qty >= max ? ' disabled' : ''}>+</button>
    </div>
    <div class="detail-actions">
      ${actions.add ? `<button type="button" class="btn" id="add-to-cart" data-add="${product.id}">Savatga qo'shish</button>` : ''}
      ${actions.notify ? `<button type="button" class="btn btn-secondary" data-notify="${product.id}">Menga xabar bering</button>` : ''}
    </div>
  </div>
</article>`;
}

/** Notify me dialog (feature F1.5 AC3, built later). */
export function renderNotifyDialog({ productName, error = '' }) {
  return `
<div class="dialog-backdrop" id="notify-dialog" role="dialog" aria-modal="true" aria-label="Mahsulot qaytganda xabar bering">
  <form class="dialog" id="notify-form" novalidate>
    <h2>Mahsulot qaytganda xabar bering</h2>
    <p>${esc(productName)}</p>
    <label>Email <input id="notify-email" type="email" autocomplete="email"></label>
    <p class="field-error" id="notify-error" role="alert">${esc(error)}</p>
    <div class="dialog-actions">
      <button type="button" class="btn btn-secondary" id="notify-cancel">Bekor qilish</button>
      <button type="submit" class="btn">Menga xabar bering</button>
    </div>
  </form>
</div>`;
}
