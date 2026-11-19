import { buildUrl } from './routes.js';

export class ApiError extends Error {
  constructor(message, status, body = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Browser client for the REST API. `fetchFn` and `cartSession` are injected.
 * Every request carries the cart id; responses that contain a cartId update it.
 */
export function createApi({ fetchFn, cartSession }) {
  async function request(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const cartId = cartSession.get();
    if (cartId) headers['X-Cart-Id'] = cartId;
    const response = await fetchFn(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(data.error ?? "So'rov bajarilmadi", response.status, data);
    if (data && typeof data.cartId === 'string') cartSession.set(data.cartId);
    return data;
  }

  return {
    config: () => request('/api/config'),
    categories: () => request('/api/categories'),
    products: (query) => request(buildUrl('/api/products', query)),
    product: (id) => request(`/api/products/${id}`),
    suggest: (q) => request(buildUrl('/api/suggest', { q })),
    cart: () => request('/api/cart'),
    addItem: (productId, quantity = 1) =>
      request('/api/cart/items', { method: 'POST', body: { productId, quantity } }),
    setQuantity: (lineId, quantity) =>
      request(`/api/cart/lines/${lineId}`, { method: 'PATCH', body: { quantity } }),
    removeLine: (lineId) => request(`/api/cart/lines/${lineId}`, { method: 'DELETE' }),
    applyPromo: (code) => request('/api/cart/promo', { method: 'POST', body: { code } }),
    removePromo: () => request('/api/cart/promo', { method: 'DELETE' }),
    clearCart: () => request('/api/cart/clear', { method: 'POST' }),
    slots: () => request('/api/delivery/slots'),
    setDelivery: (fields) => request('/api/checkout/delivery', { method: 'POST', body: fields }),
    pay: (card) => request('/api/checkout/pay', { method: 'POST', body: card }),
    order: (number) => request(`/api/orders/${number}`),
    devOrders: () => request('/api/dev/orders'),
    notifyMe: (email, productId) =>
      request('/api/notify-me', { method: 'POST', body: { email, productId } }),
  };
}
