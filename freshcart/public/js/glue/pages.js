/**
 * Page controllers: fetch data, render with the pure ui/* functions and wire events.
 * Browser-only DOM glue (not unit tested; all rules and markup it uses are).
 */
import { ApiError } from '../api.js';
import { esc } from '../html.js';
import { buildUrl } from '../routes.js';
import { shouldPushCategoryUrl, showProductNotFoundPage, stepperMax, toastMs } from '../rules.js';
import { renderCartPage } from '../ui/cart.js';
import { renderDetail, renderListingPage, renderNotifyDialog, renderProductNotFound, renderSearchPage } from '../ui/catalog.js';
import { renderPageNotFound } from '../ui/chrome.js';
import { renderConfirmation, renderDelivery, renderOrders, renderPayment } from '../ui/checkout.js';
import { validateCard, validateDelivery, validateEmail } from '/shared/validation.js';
import { showToast } from './toast.js';

async function getCategories(app) {
  app.state.categories ??= await app.api.categories();
  return app.state.categories;
}

/** Add to cart from a card or the detail page, with the matching toast. */
async function addToCart(app, productId, qty = 1) {
  try {
    const cart = await app.api.addItem(Number(productId), qty);
    app.setCart(cart);
    if (cart.limitReached) showToast('Maksimal miqdorga yetildi');
    else showToast("Savatga qo'shildi", toastMs(app.ctx.defects));
  } catch (error) {
    showToast(error.message ?? "Savatga qo'shib bo'lmadi");
  }
}

/** Notify me dialog (only built in the reference build; the training build has a stub button). */
async function openNotifyDialog(app, productId) {
  if (!app.ctx.features.notifyMe) return; // F1.5 stub: nothing happens
  const product = await app.api.product(productId);
  const holder = document.createElement('div');
  holder.innerHTML = renderNotifyDialog({ productName: product.name });
  document.body.append(holder);
  const close = () => holder.remove();
  holder.querySelector('#notify-cancel').onclick = close;
  holder.querySelector('#notify-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const email = holder.querySelector('#notify-email').value;
    const message = validateEmail(email);
    if (message) {
      holder.querySelector('#notify-error').textContent = message;
      return;
    }
    try {
      await app.api.notifyMe(email, productId);
      close();
      showToast("Mahsulot qaytganda sizga email yuboramiz.");
    } catch (error) {
      holder.querySelector('#notify-error').textContent = error.message;
    }
  };
}

/** Clicks shared by every page that shows product cards or the detail buttons. */
function commonClick(app, ev) {
  const add = ev.target.closest('[data-add]');
  if (add) {
    const qty = app.currentQty ? app.currentQty() : 1;
    addToCart(app, add.dataset.add, add.id === 'add-to-cart' ? qty : 1);
    return true;
  }
  const notify = ev.target.closest('[data-notify]');
  if (notify) {
    openNotifyDialog(app, notify.dataset.notify);
    return true;
  }
  return false;
}

const listingState = (q) => ({
  page: Number(q.page) || 1,
  sort: q.sort || 'name-asc',
  category: q.category || undefined,
  min: q.min || undefined,
  max: q.max || undefined,
});

export function createPages() {
  return {
    home(app) {
      return app.navigate('/products', { replace: true });
    },

    async products(app, _route, query) {
      const { api, ctx, main } = app;
      const categories = await getCategories(app);
      const state = listingState(query);
      let lastData = null;
      let priceError = '';

      const pushUrl = () => app.pushUrl(buildUrl('/products', state));
      async function draw() {
        try {
          lastData = await api.products(state);
          priceError = '';
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 400) throw error;
          priceError = error.message; // Min greater than Max: the grid stays as it was
          lastData ??= await api.products({ ...state, min: undefined, max: undefined });
        }
        main.innerHTML = renderListingPage({ data: lastData, categories, state, priceError, ctx });
      }
      const redraw = (push = true) => {
        state.page = 1;
        if (push) pushUrl();
        return draw();
      };

      main.onclick = (ev) => {
        if (commonClick(app, ev)) return;
        const page = ev.target.closest('[data-page]');
        if (page) {
          state.page = Number(page.dataset.page);
          pushUrl();
          draw().then(() => window.scrollTo(0, 0));
          return;
        }
        if (ev.target.closest('#price-apply')) {
          state.min = main.querySelector('#price-min').value || undefined;
          state.max = main.querySelector('#price-max').value || undefined;
          redraw();
        } else if (ev.target.closest('#clear-all')) {
          Object.assign(state, { category: undefined, min: undefined, max: undefined });
          redraw();
        } else if (ev.target.closest('[data-remove-filter]')) {
          const what = ev.target.closest('[data-remove-filter]').dataset.removeFilter;
          if (what === 'category') state.category = undefined;
          else Object.assign(state, { min: undefined, max: undefined });
          redraw();
        } else if (ev.target.closest('#filters-toggle')) {
          main.querySelector('#filters').classList.toggle('open');
        }
      };
      main.onchange = (ev) => {
        if (ev.target.name === 'category') {
          state.category = ev.target.value || undefined;
          redraw(shouldPushCategoryUrl(ctx.defects));
        } else if (ev.target.id === 'sort') {
          state.sort = ev.target.value;
          redraw();
        }
      };
      await draw();
    },

    async search(app, _route, query) {
      const { api, ctx, main } = app;
      const term = query.q ?? '';
      const state = { page: Number(query.page) || 1, sort: query.sort || 'name-asc' };
      async function draw() {
        const data = await api.products({ q: term, page: state.page, sort: state.sort });
        main.innerHTML = renderSearchPage({ term, data, state, ctx });
      }
      main.onclick = (ev) => {
        if (commonClick(app, ev)) return;
        const page = ev.target.closest('[data-page]');
        if (page) {
          state.page = Number(page.dataset.page);
          app.pushUrl(buildUrl('/search', { q: term, page: state.page, sort: state.sort }));
          draw();
        }
      };
      main.onchange = (ev) => {
        if (ev.target.id !== 'sort') return;
        state.sort = ev.target.value;
        state.page = 1;
        app.pushUrl(buildUrl('/search', { q: term, sort: state.sort }));
        draw();
      };
      await draw();
    },

    async product(app, route) {
      const { api, ctx, main } = app;
      let product;
      try {
        product = await api.product(route.params.id);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
        // FC_DETAIL_404_BLANK: the training build renders nothing for an unknown id.
        main.innerHTML = showProductNotFoundPage(ctx.defects) ? renderProductNotFound() : '';
        return;
      }
      const categories = await getCategories(app);
      const categoryName = categories.find((c) => c.slug === product.category)?.name ?? '';
      let qty = 1;
      const draw = () => {
        main.innerHTML = renderDetail({ product, categoryName, qty, ctx });
      };
      app.currentQty = () => qty;
      app.cleanups.push(() => {
        app.currentQty = null;
      });
      main.onclick = (ev) => {
        if (ev.target.closest('#qty-plus')) {
          qty = Math.min(stepperMax(ctx.defects), qty + 1);
          draw();
        } else if (ev.target.closest('#qty-minus')) {
          qty = Math.max(1, qty - 1);
          draw();
        } else if (ev.target.closest('.thumb') && ctx.features.thumbnailSwap) {
          const n = ev.target.closest('.thumb').dataset.image;
          main.querySelector('#main-image').src = `/img/${product.id}/${n}.svg`;
        } else {
          commonClick(app, ev);
        }
      };
      draw();
    },

    async cart(app) {
      const { api, ctx, main } = app;
      let promoError = '';
      async function draw() {
        const cart = await api.cart();
        app.setCart(cart);
        main.innerHTML = renderCartPage({ cart, promoError, ctx });
      }
      async function change(action) {
        try {
          const cart = await action();
          app.setCart(cart);
          if (cart.limitReached) showToast('Maksimal miqdorga yetildi');
        } catch (error) {
          showToast(error.message);
        }
        await draw();
      }
      const lineOf = (id) => app.state.cart.lines.find((l) => l.lineId === id);

      main.onclick = async (ev) => {
        const t = ev.target;
        const minus = t.closest('[data-qty-minus]');
        const plus = t.closest('[data-qty-plus]');
        const remove = t.closest('[data-remove-line]');
        if (minus) change(() => api.setQuantity(minus.dataset.qtyMinus, lineOf(minus.dataset.qtyMinus).quantity - 1));
        else if (plus) change(() => api.setQuantity(plus.dataset.qtyPlus, lineOf(plus.dataset.qtyPlus).quantity + 1));
        else if (remove) change(() => api.removeLine(remove.dataset.removeLine));
        else if (t.closest('#promo-remove')) {
          promoError = '';
          change(() => api.removePromo());
        } else if (t.closest('#promo-apply')) {
          const code = main.querySelector('#promo-input').value;
          try {
            app.setCart(await api.applyPromo(code));
            promoError = '';
          } catch (error) {
            promoError = error.message;
          }
          await draw();
        }
      };
      main.onchange = (ev) => {
        const input = ev.target.closest('[data-qty-input]');
        if (!input) return;
        const value = Number.parseInt(input.value, 10);
        if (!Number.isInteger(value) || value < 1) return draw();
        return change(() => api.setQuantity(input.dataset.qtyInput, value));
      };
      await draw();
    },

    async delivery(app) {
      const { api, ctx, main } = app;
      const cart = await api.cart();
      app.setCart(cart);
      if (cart.lines.length === 0) return app.navigate('/cart', { replace: true });
      const { days } = await api.slots();
      const saved = cart.delivery;
      const form = {
        fullName: saved?.fullName ?? '',
        phone: saved?.phone ?? '',
        street: saved?.street ?? '',
        city: saved?.city ?? '',
        zip: saved?.zip ?? '',
      };
      let selectedSlot = saved?.slotId ?? null;
      const touched = {};
      let submitted = false;
      let holdUntil = selectedSlot ? Date.now() + 600000 : null;
      const slotOf = (id) => days.flatMap((d) => d.slots).find((s) => s.id === id);
      const errors = () => validateDelivery(form, ctx.defects);
      const canContinue = () => Object.keys(errors()).length === 0 && Boolean(selectedSlot && slotOf(selectedSlot)?.selectable);
      const holdSeconds = () => (holdUntil ? Math.max(0, Math.ceil((holdUntil - Date.now()) / 1000)) : 600);
      const visible = () => Object.fromEntries(Object.entries(errors()).filter(([id]) => touched[id] || submitted));

      main.innerHTML = renderDelivery({ form, errors: visible(), days, selectedSlot, holdSeconds: holdSeconds(), canContinue: canContinue(), ctx });

      function updateUi() {
        const current = errors();
        for (const id of Object.keys(form)) {
          const show = touched[id] || submitted;
          main.querySelector(`[data-error-for="${id}"]`).textContent = show ? (current[id] ?? '') : '';
          main.querySelector(`#${id}`).classList.toggle('invalid', Boolean(show && current[id]));
        }
        main.querySelector('#continue').disabled = !canContinue();
        for (const b of main.querySelectorAll('[data-slot]')) b.classList.toggle('selected', b.dataset.slot === selectedSlot);
        const hold = main.querySelector('#hold');
        if (hold) {
          hold.hidden = !selectedSlot;
          const s = holdSeconds();
          hold.textContent = `Vaqt ushlab turilmoqda: ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
        }
      }
      const showServerError = (message) => {
        main.querySelector('#server-error').textContent = message;
      };

      if (ctx.features.holdCountdown) {
        const ticker = setInterval(() => {
          if (selectedSlot && holdSeconds() === 0) {
            selectedSlot = null;
            holdUntil = null;
            showServerError("Vaqtni ushlab turish muddati tugadi. Vaqtni qaytadan tanlang.");
          }
          updateUi();
        }, 1000);
        app.cleanups.push(() => clearInterval(ticker));
      }

      main.oninput = (ev) => {
        if (ev.target.id in form) {
          form[ev.target.id] = ev.target.value;
          updateUi();
        }
      };
      // focusout has no on* property in browsers, so it needs addEventListener.
      app.on('focusout', (ev) => {
        if (ev.target.id in form) {
          touched[ev.target.id] = true;
          updateUi();
        }
      });
      main.onclick = (ev) => {
        const slot = ev.target.closest('[data-slot]');
        if (!slot || slot.disabled) return;
        selectedSlot = slot.dataset.slot;
        holdUntil = Date.now() + 600000;
        showServerError('');
        updateUi();
      };
      main.onsubmit = async (ev) => {
        ev.preventDefault();
        submitted = true;
        updateUi();
        if (!canContinue()) return;
        try {
          await api.setDelivery({ ...form, slotId: selectedSlot });
          await app.navigate('/checkout/payment');
        } catch (error) {
          showServerError(error.message);
        }
      };
      return undefined;
    },

    async payment(app) {
      const { api, ctx, main } = app;
      const cart = await api.cart();
      app.setCart(cart);
      if (cart.lines.length === 0) return app.navigate('/cart', { replace: true });
      if (!cart.delivery) return app.navigate('/checkout/delivery', { replace: true });
      const form = { number: '', expiry: '', cvc: '', name: '' };
      const touched = {};
      let submitted = false;
      let done = false;
      const errors = () => validateCard(form, ctx.defects, ctx.now);
      const canPlace = () => Object.keys(errors()).length === 0;
      main.innerHTML = renderPayment({ form, errors: {}, totalCents: cart.totals.totalCents, canPlace: false });

      function updateUi() {
        const current = errors();
        for (const id of Object.keys(form)) {
          const show = touched[id] || submitted;
          main.querySelector(`[data-error-for="${id}"]`).textContent = show ? (current[id] ?? '') : '';
          main.querySelector(`#${id}`).classList.toggle('invalid', Boolean(show && current[id]));
        }
        main.querySelector('#place-order').disabled = !canPlace();
      }

      main.oninput = (ev) => {
        if (ev.target.id in form) {
          form[ev.target.id] = ev.target.value;
          updateUi();
        }
      };
      // focusout has no on* property in browsers, so it needs addEventListener.
      app.on('focusout', (ev) => {
        if (ev.target.id in form) {
          touched[ev.target.id] = true;
          updateUi();
        }
      });
      main.onsubmit = async (ev) => {
        ev.preventDefault();
        submitted = true;
        updateUi();
        if (!canPlace()) return;
        const button = main.querySelector('#place-order');
        // FC_DOUBLE_SUBMIT_TWO_ORDERS: the training build leaves the button enabled while the payment runs.
        if (!ctx.defects.FC_DOUBLE_SUBMIT_TWO_ORDERS) {
          button.disabled = true;
          button.textContent = 'Jarayonda...';
        }
        try {
          const order = await api.pay(form);
          if (done) return;
          done = true;
          app.setCart(await api.clearCart());
          await app.navigate(buildUrl('/order/confirmation', { order: order.number }));
        } catch (error) {
          main.querySelector('#server-error').textContent = error.message;
          button.textContent = 'Buyurtma berish';
          updateUi();
        }
      };
      return undefined;
    },

    async confirmation(app, _route, query) {
      try {
        app.main.innerHTML = renderConfirmation(await app.api.order(query.order ?? ''));
      } catch (error) {
        app.main.innerHTML = `<h1>Buyurtma topilmadi</h1><p class="field-error" role="alert">${esc(error.message)}</p><a class="btn" href="/products" data-link>Xaridni davom ettirish</a>`;
      }
    },

    async devOrders(app) {
      app.main.innerHTML = renderOrders(await app.api.devOrders());
    },

    notFound(app) {
      app.main.innerHTML = renderPageNotFound();
    },
  };
}
