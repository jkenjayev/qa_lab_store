import { Router } from 'express';
import { ValidationError } from '../domain/errors.js';
import { toDateStr, toTimeStr } from '../shared/time.js';
import { wrap } from './http.js';

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const clockView = (clock) => {
  const now = clock.now();
  return { now: `${toDateStr(now)}T${toTimeStr(now)}`, today: toDateStr(now), time: toTimeStr(now) };
};

/** Training helpers: move the clock, reset the data, read the fake email outbox, check the storage. */
export function devRoutes() {
  const router = Router();
  router.get('/api/dev/clock', wrap((req, res) => res.json(clockView(req.app.locals.clock))));
  router.post('/api/dev/clock', wrap((req, res) => {
    const { clock } = req.app.locals;
    const { now, advanceMinutes } = req.body ?? {};
    try {
      if (typeof now === 'string') clock.set(now);
      else if (Number.isFinite(advanceMinutes)) clock.advance(advanceMinutes);
      else throw new RangeError('Aniq vaqtni (YYYY-MM-DDTHH:mm) yoki advanceMinutes qiymatini yuboring');
    } catch (error) {
      throw new ValidationError(error.message);
    }
    res.json(clockView(clock));
  }));
  router.post('/api/dev/reset', wrap((req, res) => {
    req.app.locals.reset();
    res.json({ ok: true });
  }));
  router.get('/api/dev/storage', wrap((req, res) => res.json(req.app.locals.storage.status())));
  router.get('/api/dev/outbox', wrap((req, res) => res.json(req.app.locals.services.repos.outbox.list())));
  router.get('/dev/outbox', wrap((req, res) => {
    const items = req.app.locals.services.repos.outbox.list();
    const body = items.length
      ? items.map((m) => `<article><h2>${escapeHtml(m.subject)}</h2><p>Kimga: ${escapeHtml(m.to)} - ${escapeHtml(m.sentAt)}</p><pre>${escapeHtml(m.body)}</pre></article>`).join('')
      : '<p>Hozircha xat yuborilmagan.</p>';
    res.type('html').send(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>ClinicBook pochta qutisi</title></head><body style="font-family:sans-serif;max-width:640px;margin:2rem auto"><h1>Ichki pochta qutisi (test muhiti)</h1>${body}</body></html>`);
  }));
  return router;
}
