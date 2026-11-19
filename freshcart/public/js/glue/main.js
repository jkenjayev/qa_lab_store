/** Browser entry: loads config, builds the header, runs the History API router. DOM glue, not unit tested. */
import { createApi } from '../api.js';
import { createCartSession, pickStorage } from '../cartSession.js';
import { esc } from '../html.js';
import { buildUrl, matchRoute, parseQuery } from '../routes.js';
import { suggestMinChars } from '../rules.js';
import { renderMiniCart } from '../ui/cart.js';
import { renderCartBadge, renderHeaderShell, renderSuggestions } from '../ui/chrome.js';
import { createPages } from './pages.js';

const EVENT_PROPS = ['onclick', 'onchange', 'oninput', 'onsubmit'];

function safeStorage(name) {
  try {
    return window[name];
  } catch {
    return { getItem: () => null, setItem() {}, removeItem() {} };
  }
}

async function boot() {
  const config = await fetch('/api/config').then((r) => r.json());
  const ctx = {
    mode: config.mode,
    defects: config.defects,
    features: config.features,
    now: new Date(config.now),
  };
  const cartSession = createCartSession(
    pickStorage(ctx.defects, { local: safeStorage('localStorage'), session: safeStorage('sessionStorage') }),
  );
  const api = createApi({ fetchFn: (...args) => fetch(...args), cartSession });

  const header = document.getElementById('header');
  const main = document.getElementById('app');
  header.innerHTML = renderHeaderShell({ defects: ctx.defects });
  const input = header.querySelector('#search-input');
  const clear = header.querySelector('#search-clear');
  const suggestions = header.querySelector('#suggestions');
  const miniCart = header.querySelector('#mini-cart');
  const cartButton = header.querySelector('#cart-button');

  const app = {
    ctx,
    api,
    main,
    state: { cart: null, categories: null },
    cleanups: [],
    currentQty: null,
    setCart(cart) {
      app.state.cart = cart;
      header.querySelector('#cart-badge').textContent = renderCartBadge(cart, ctx.defects);
      miniCart.innerHTML = renderMiniCart(cart);
    },
    /** Listener that is removed when the page changes (for events without an on* property). */
    on(type, handler) {
      main.addEventListener(type, handler);
      app.cleanups.push(() => main.removeEventListener(type, handler));
    },
    pushUrl: (url) => history.pushState({}, '', url),
    navigate(url, { replace = false } = {}) {
      history[replace ? 'replaceState' : 'pushState']({}, '', url);
      return render();
    },
  };
  const pages = createPages();

  const hideSuggestions = () => {
    suggestions.hidden = true;
    suggestions.innerHTML = '';
  };
  const closeMiniCart = () => {
    miniCart.hidden = true;
    cartButton.setAttribute('aria-expanded', 'false');
  };

  async function render() {
    app.cleanups.splice(0).forEach((fn) => fn());
    for (const prop of EVENT_PROPS) main[prop] = null;
    hideSuggestions();
    closeMiniCart();
    const route = matchRoute(location.pathname);
    const query = parseQuery(location.search);
    input.value = route.name === 'search' ? (query.q ?? '') : '';
    clear.hidden = !input.value;
    try {
      await (pages[route.name] ?? pages.notFound)(app, route, query);
    } catch (error) {
      main.innerHTML = `<p class="field-error" role="alert">${esc(error.message)}</p>`;
    }
  }

  // Header search with suggestions after a 300 ms pause.
  let timer;
  input.addEventListener('input', () => {
    clear.hidden = !input.value;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const term = input.value.trim();
      if (term.length < suggestMinChars(ctx.defects)) return hideSuggestions();
      const items = await api.suggest(term);
      if (input.value.trim() !== term) return undefined;
      if (items.length === 0) return hideSuggestions();
      suggestions.innerHTML = renderSuggestions(items, term);
      suggestions.hidden = false;
      return undefined;
    }, 300);
  });
  header.querySelector('#search-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const term = input.value.trim();
    if (!term) return;
    hideSuggestions();
    app.navigate(buildUrl('/search', { q: term }));
  });
  clear.addEventListener('click', () => {
    input.value = '';
    clear.hidden = true;
    hideSuggestions();
    input.focus();
  });
  cartButton.addEventListener('click', () => {
    const open = miniCart.hidden;
    miniCart.hidden = !open;
    cartButton.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      hideSuggestions();
      closeMiniCart();
    }
  });
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('.search-box')) hideSuggestions();
    if (!ev.target.closest('.cart-wrap')) closeMiniCart();
    const link = ev.target.closest('a[data-link]');
    if (link && ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey) {
      ev.preventDefault();
      app.navigate(link.getAttribute('href'));
    }
  });
  window.addEventListener('popstate', render);

  app.setCart(await api.cart());
  await render();
}

boot().catch((error) => {
  document.getElementById('app').textContent = `FreshCart ishga tushmadi: ${error.message}`;
});
