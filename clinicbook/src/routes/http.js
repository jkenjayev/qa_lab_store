import { ConflictError, ForbiddenError, LockedError, NotFoundError, UnauthorizedError, ValidationError } from '../domain/errors.js';

export const PATIENT_COOKIE = 'cb_patient';
export const STAFF_COOKIE = 'cb_staff';

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index > 0) cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

export function setCookie(res, name, value) {
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax`);
}
export function clearCookie(res, name) {
  res.append('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** Lets route handlers throw (sync or async); errors go to the error middleware. */
export const wrap = (handler) => (req, res, next) => {
  Promise.resolve()
    .then(() => handler(req, res))
    .catch(next);
};

/** Maps domain errors to HTTP status codes and JSON bodies. */
export function toHttpError(error) {
  if (error instanceof ValidationError) return { status: 400, body: { error: error.message, fields: error.fields } };
  if (error instanceof UnauthorizedError) return { status: 401, body: { error: error.message, expired: error.expired } };
  if (error instanceof ForbiddenError) return { status: 403, body: { error: error.message } };
  if (error instanceof NotFoundError) return { status: 404, body: { error: error.message } };
  if (error instanceof ConflictError) return { status: 409, body: { error: error.message, details: error.details } };
  if (error instanceof LockedError) return { status: 429, body: { error: error.message } };
  if (error?.type === 'entity.parse.failed') return { status: 400, body: { error: 'Soʻrov matni yaroqli JSON emas' } };
  return { status: 500, body: { error: 'Xatolik yuz berdi' } };
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, _req, res, _next) {
  const { status, body } = toHttpError(error);
  if (status === 500) console.error(error);
  res.status(status).json(body);
}
