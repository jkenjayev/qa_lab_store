/** Tiny DOM glue: mounting HTML, event delegation, toasts, navigation. No business logic here. */
let handlers = { click: {}, change: {}, input: {}, submit: {} };

export function setHandlers(next = {}) {
  handlers = { click: {}, change: {}, input: {}, submit: {}, ...next };
}

export function mount(html) {
  document.getElementById('app').innerHTML = html;
}

export function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function installListeners(navigate) {
  const root = document.getElementById('app');
  root.addEventListener('click', (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (actionEl && handlers.click[actionEl.dataset.action]) {
      event.preventDefault();
      handlers.click[actionEl.dataset.action](actionEl, event);
      return;
    }
    const link = event.target.closest('a[href^="/"]');
    if (link && !link.hasAttribute('download') && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      navigate(link.getAttribute('href'));
    }
  });
  for (const type of ['change', 'input']) {
    root.addEventListener(type, (event) => handlers[type][event.target.id]?.(event.target, event));
  }
  root.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submit[event.target.id]?.(event.target, event);
  });
}

export const formValues = (form) => Object.fromEntries([...form.elements].filter((e) => e.name).map((e) => [e.name, e.value]));
