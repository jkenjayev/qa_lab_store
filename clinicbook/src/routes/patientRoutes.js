import { Router } from 'express';
import { PATIENT_COOKIE, clearCookie, parseCookies, setCookie, wrap } from './http.js';

/** Public catalog and patient portal API. */
export function patientRoutes() {
  const router = Router();
  const svc = (req) => req.app.locals.services;
  const patientOf = (req) => svc(req).patientAuth.authenticate(parseCookies(req.headers.cookie)[PATIENT_COOKIE]);

  router.get('/specialties', wrap((req, res) => res.json(svc(req).doctors.specialties())));
  router.get('/doctors', wrap((req, res) => {
    const { specialty, name, sort } = req.query;
    res.json(svc(req).doctors.list({ specialty: String(specialty ?? ''), name: String(name ?? ''), sort: String(sort ?? 'next') }));
  }));
  router.get('/doctors/:id', wrap((req, res) => res.json(svc(req).doctors.get(req.params.id))));
  router.get('/doctors/:id/week', wrap((req, res) => res.json({ days: svc(req).slots.week(req.params.id) })));
  router.get('/doctors/:id/slots', wrap((req, res) => {
    const date = String(req.query.date ?? '');
    res.json({ date, times: svc(req).slots.displayTimes(req.params.id, date) });
  }));

  router.post('/patient/register', wrap((req, res) => res.status(201).json(svc(req).patientAuth.register(req.body ?? {}))));
  router.post('/patient/login', wrap((req, res) => {
    const { token, patient } = svc(req).patientAuth.login(req.body?.email, req.body?.password);
    setCookie(res, PATIENT_COOKIE, token);
    res.json({ patient });
  }));
  router.post('/patient/logout', wrap((req, res) => {
    svc(req).patientAuth.logout(parseCookies(req.headers.cookie)[PATIENT_COOKIE]);
    clearCookie(res, PATIENT_COOKIE);
    res.json({ ok: true });
  }));
  router.get('/patient/me', wrap((req, res) => res.json({ patient: patientOf(req) })));
  // Used by every page load: answers 200 with patient null instead of a 401 that would clutter the console.
  router.get('/patient/session', wrap((req, res) => {
    try {
      res.json({ patient: patientOf(req) });
    } catch {
      res.json({ patient: null });
    }
  }));

  router.post('/bookings', wrap((req, res) => {
    const patient = patientOf(req);
    res.status(201).json(svc(req).booking.book({ ...req.body, patientId: patient.id }));
  }));
  router.get('/appointments/mine', wrap((req, res) => res.json(svc(req).myAppointments.listMine(patientOf(req).id))));
  router.post('/appointments/:ref/cancel', wrap((req, res) => res.json(svc(req).myAppointments.cancel(patientOf(req).id, req.params.ref))));
  router.post('/appointments/:ref/reschedule-start', wrap((req, res) => res.json(svc(req).myAppointments.rescheduleStart(patientOf(req).id, req.params.ref))));
  router.post('/appointments/:ref/reschedule', wrap((req, res) => res.json(svc(req).myAppointments.reschedule(patientOf(req).id, req.params.ref, req.body ?? {}))));
  return router;
}
