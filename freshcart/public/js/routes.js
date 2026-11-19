/** Browser routes (History API paths). */

const STATIC = {
  '/': 'home',
  '/products': 'products',
  '/search': 'search',
  '/cart': 'cart',
  '/checkout/delivery': 'delivery',
  '/checkout/payment': 'payment',
  '/order/confirmation': 'confirmation',
  '/dev/orders': 'devOrders',
};

export function matchRoute(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (STATIC[path]) return { name: STATIC[path], params: {} };
  const product = /^\/products\/([^/]+)$/.exec(path);
  if (product) return { name: 'product', params: { id: decodeURIComponent(product[1]) } };
  return { name: 'notFound', params: {} };
}

export function parseQuery(search) {
  return Object.fromEntries(new URLSearchParams(search));
}

/** Build a path with a query string, leaving out empty values. */
export function buildUrl(path, query = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
