import { esc } from '../html.js';
import { badgeCount, searchMaxLength } from '../rules.js';

/** Bold the first case-insensitive match of the term inside a product name (HTML, escaped). */
export function highlight(name, term) {
  const index = term ? name.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (index < 0) return esc(name);
  const end = index + term.length;
  return `${esc(name.slice(0, index))}<b>${esc(name.slice(index, end))}</b>${esc(name.slice(end))}`;
}

/** Heading of the search results page. */
export function resultsHeadingHtml(term, defects) {
  // FC_SEARCH_XSS_HEADING: "Search term is rendered as HTML in the results heading (XSS)"
  const shown = defects.FC_SEARCH_XSS_HEADING ? term : esc(term);
  return `"${shown}" bo'yicha natijalar`;
}

/** Static header: logo, search box with suggestions dropdown, cart button with mini-cart. */
export function renderHeaderShell({ defects, term = '' }) {
  const max = searchMaxLength(defects);
  return `
<div class="header-inner">
  <a class="logo" href="/products" data-link>FreshCart</a>
  <form id="search-form" class="search" role="search">
    <div class="search-box">
      <input id="search-input" name="q" type="text" autocomplete="off" placeholder="Mahsulotlarni qidirish..."
        aria-label="Mahsulotlarni qidirish" value="${esc(term)}"${max ? ` maxlength="${max}"` : ''}>
      <button type="button" id="search-clear" class="icon-btn" aria-label="Qidiruvni tozalash"${term ? '' : ' hidden'}>&times;</button>
      <ul id="suggestions" class="suggestions" role="listbox" hidden></ul>
    </div>
    <button type="submit" class="icon-btn" aria-label="Qidirish">Qidirish</button>
  </form>
  <div class="cart-wrap">
    <button type="button" id="cart-button" class="cart-button" aria-expanded="false" aria-controls="mini-cart">Savat (<span id="cart-badge">0</span>)</button>
    <div id="mini-cart" class="mini-cart" hidden></div>
  </div>
</div>`;
}

export function renderCartBadge(cart, defects) {
  return String(badgeCount(cart.lines, defects));
}

/** Suggestion rows. Each links to the search results for that product name. */
export function renderSuggestions(items, term) {
  return items
    .map(
      (item) =>
        `<li role="option" data-suggestion="${esc(item.name)}"><a href="/search?q=${encodeURIComponent(item.name)}" data-link>${highlight(item.name, term)}</a></li>`,
    )
    .join('');
}

export function renderPageNotFound() {
  return `<div class="not-found"><h1>Sahifa topilmadi</h1><a href="/products" data-link>Mahsulotlarga qaytish</a></div>`;
}
