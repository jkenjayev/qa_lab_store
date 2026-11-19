import { HttpError } from '../domain/errors.js';

/** Wrap an async handler so rejected promises reach the error middleware. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/** Maps service errors to JSON responses: { error, fieldErrors? }. */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: "So'rov matni yaroqsiz JSON" });
  console.error(err);
  return res.status(500).json({ error: 'Kutilmagan server xatosi' });
}

/** Cart id sent by the browser in the X-Cart-Id header (null when absent). */
export const cartIdOf = (req) => req.get('x-cart-id') || null;
