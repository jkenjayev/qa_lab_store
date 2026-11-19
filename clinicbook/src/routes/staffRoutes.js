import { Router } from 'express';
import { ForbiddenError } from '../domain/errors.js';
import { canAccess } from '../shared/access.js';
import { MSG } from '../shared/messages.js';
import { STAFF_COOKIE, clearCookie, parseCookies, setCookie, wrap } from './http.js';

/** Back office API. Every route except login needs a live staff session. */
export function staffRoutes() {
  const router = Router();
  const svc = (req) => req.app.locals.services;
  const staffOf = (req) => svc(req).staffAuth.authenticate(parseCookies(req.headers.cookie)[STAFF_COOKIE]);
  const need = (req, resource) => {
    const staff = staffOf(req);
    if (!canAccess(staff.role, resource, req.app.locals.defects)) throw new ForbiddenError(MSG.FORBIDDEN);
    return staff;
  };

  router.post('/staff/login', wrap((req, res) => {
    const { token, user, redirect } = svc(req).staffAuth.login(req.body?.email, req.body?.password);
    setCookie(res, STAFF_COOKIE, token);
    res.json({ user, redirect });
  }));
  router.post('/staff/logout', wrap((req, res) => {
    svc(req).staffAuth.logout(parseCookies(req.headers.cookie)[STAFF_COOKIE]);
    clearCookie(res, STAFF_COOKIE);
    res.json({ ok: true });
  }));
  router.get('/staff/me', wrap((req, res) => res.json({ user: staffOf(req) })));

  router.get('/dashboard', wrap((req, res) => res.json(svc(req).dashboard.stats(staffOf(req)))));

  router.get('/schedules/:doctorId', wrap((req, res) => res.json(svc(req).schedules.get(need(req, 'schedules'), req.params.doctorId))));
  router.put('/schedules/:doctorId', wrap((req, res) => {
    const { confirm, ...body } = req.body ?? {};
    res.json(svc(req).schedules.save(need(req, 'schedules'), req.params.doctorId, body, { confirm: confirm === true }));
  }));

  router.get('/admin/appointments', wrap((req, res) => {
    need(req, 'appointments');
    res.json(svc(req).adminAppointments.list(req.query));
  }));
  router.get('/patients/:id', wrap((req, res) => {
    const staff = need(req, 'patients');
    res.json(svc(req).patientRecords.get(staff, req.params.id, { all: req.query.all === '1' }));
  }));

  router.get('/reports/daily', wrap((req, res) => {
    const staff = staffOf(req);
    const file = svc(req).reports.dailyCsv(staff, String(req.query.date ?? ''), String(req.query.format ?? 'csv'));
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.content);
  }));
  return router;
}
