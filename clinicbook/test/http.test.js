import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDefects } from '../src/defects.js';
import { TEST_PASSWORD, startApp } from './helpers.js';

const login = (c, email) => c.post('/api/staff/login', { email, password: TEST_PASSWORD });

describe('HTTP API (reference build)', () => {
  let app;
  before(async () => { app = await startApp(createDefects('off')); });
  after(() => app.close());

  it('serves config, pages and static files', async () => {
    const c = app.client();
    const config = await c.get('/api/config');
    assert.equal(config.json.now, '2026-11-19T13:10');
    assert.equal(config.json.today, '2026-11-19');
    assert.equal(config.json.defects.CB_SLOTS_12H, false);
    for (const path of ['/', '/doctors', '/doctors/doctor-1', '/register', '/login', '/book/confirm', '/my-appointments', '/admin/login', '/admin/appointments']) {
      const page = await c.get(path);
      assert.equal(page.status, 200, path);
      assert.match(page.text, /<div id="app">/);
    }
    assert.equal((await c.get('/css/app.css')).status, 200);
    assert.equal((await c.get('/js/main.js')).status, 200);
    assert.equal((await c.get('/src/shared/time.js')).status, 200);
  });

  it('lists and filters doctors, week strip and slots', async () => {
    const c = app.client();
    assert.equal((await c.get('/api/doctors')).json.length, 12);
    assert.equal((await c.get('/api/doctors?name=rao')).json.length, 1);
    assert.equal((await c.get('/api/doctors?specialty=Kardiologiya&sort=experience')).json[0].name, 'Dr. A. Rao');
    assert.equal((await c.get('/api/specialties')).json.length, 8);
    assert.equal((await c.get('/api/doctors/doctor-1')).json.name, 'Dr. A. Rao');
    assert.equal((await c.get('/api/doctors/nope')).status, 404);
    assert.equal((await c.get('/api/doctors/doctor-1/week')).json.days.length, 7);
    assert.deepEqual((await c.get('/api/doctors/doctor-1/slots?date=2026-11-19')).json.times.slice(0, 2), ['13:30', '14:00']);
    assert.equal((await c.get('/api/doctors/doctor-1/slots?date=bad')).status, 400);
  });

  it('patient flow: register, login, book, list, reschedule, cancel, logout', async () => {
    const c = app.client();
    const register = await c.post('/api/patient/register', { fullName: 'Flow Patient', email: 'flow@example.com', phone: '+1 555 010 0000', dob: '1991-02-03', password: 'Abcdef12', confirmPassword: 'Abcdef12' });
    assert.equal(register.status, 201);
    assert.equal((await c.post('/api/patient/register', {})).status, 400);
    assert.equal((await c.post('/api/bookings', {})).status, 401);
    assert.equal((await c.post('/api/patient/login', { email: 'flow@example.com', password: 'wrong' })).status, 401);
    assert.equal((await c.post('/api/patient/login', { email: 'flow@example.com', password: 'Abcdef12' })).status, 200);
    assert.equal((await c.get('/api/patient/me')).json.patient.fullName, 'Flow Patient');
    assert.equal((await c.get('/api/patient/session')).json.patient.fullName, 'Flow Patient');
    const booked = await c.post('/api/bookings', { doctorId: 'doctor-1', date: '2026-12-01', time: '09:00', reason: 'Checkup' });
    assert.equal(booked.status, 201);
    const ref = booked.json.reference;
    assert.equal((await c.post('/api/bookings', { doctorId: 'doctor-1', date: '2026-12-01', time: '09:00', reason: 'Again' })).status, 409);
    assert.equal((await c.get('/api/appointments/mine')).json.upcoming[0].reference, ref);
    assert.equal((await c.post(`/api/appointments/${ref}/reschedule-start`)).json.doctorId, 'doctor-1');
    assert.equal((await c.post(`/api/appointments/${ref}/reschedule`, { date: '2026-12-02', time: '09:00' })).json.date, '2026-12-02');
    assert.equal((await c.post(`/api/appointments/${ref}/cancel`)).json.status, 'Cancelled');
    assert.equal((await c.post('/api/patient/logout')).status, 200);
    assert.equal((await c.get('/api/patient/me')).status, 401);
    assert.deepEqual((await c.get('/api/patient/session')).json, { patient: null });
  });

  it('login lockout answers 429', async () => {
    const c = app.client();
    let last;
    for (let i = 0; i < 5; i += 1) last = await c.post('/api/patient/login', { email: 'carlos.vega@example.com', password: 'wrong' });
    assert.equal(last.status, 429);
    assert.equal(last.json.error, 'Urinishlar soni oshib ketdi. 15 daqiqadan keyin qayta urinib koʻring.');
  });

  it('staff flow with roles', async () => {
    const admin = app.client();
    assert.equal((await admin.get('/api/staff/me')).status, 401);
    assert.equal((await admin.post('/api/staff/login', { email: 'admin@clinicbook.test', password: 'wrong' })).json.error, 'Email yoki parol notoʻgʻri');
    const ok = await login(admin, 'admin@clinicbook.test');
    assert.equal(ok.json.redirect, '/admin/dashboard');
    assert.equal((await admin.get('/api/dashboard')).json.doctors, 12);
    assert.ok((await admin.get('/api/admin/appointments')).json.total >= 57, 'the 57 seeded appointments plus bookings of earlier tests');
    assert.equal((await admin.get('/api/patients/patient-1')).json.visits.length, 10);
    assert.equal((await admin.get('/api/patients/patient-1?all=1')).json.visits.length, 12);
    const csv = await admin.get('/api/reports/daily?date=2026-11-19&format=csv');
    assert.equal(csv.status, 200);
    assert.equal(csv.headers.get('content-disposition'), 'attachment; filename="appointments-2026-11-19.csv"');
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.equal((await admin.get('/api/reports/daily?date=2026-11-19&format=pdf')).status, 400);

    const schedule = await admin.get('/api/schedules/doctor-1');
    const body = JSON.parse(JSON.stringify(schedule.json.schedule));
    body.days[1].end = '09:30';
    const warned = await admin.put('/api/schedules/doctor-1', body);
    assert.equal(warned.status, 409);
    assert.equal(warned.json.details.conflicts[0].reference, 'CB-304511');
    assert.equal((await admin.put('/api/schedules/doctor-1', { ...body, confirm: true })).status, 200);

    const reception = app.client();
    await login(reception, 'reception@clinicbook.test');
    assert.equal((await reception.get('/api/dashboard')).status, 403);
    assert.equal((await reception.get('/api/reports/daily?date=2026-11-19')).status, 403);
    assert.equal((await reception.get('/api/schedules/doctor-1')).status, 403);
    assert.equal((await reception.get('/api/admin/appointments')).status, 200);
    assert.equal((await reception.get('/api/patients/patient-1')).json.phone, '+1 555 010 1234');

    const rao = app.client();
    await login(rao, 'doctor.rao@clinicbook.test');
    assert.equal((await rao.get('/api/schedules/doctor-2')).status, 403);
    assert.equal((await rao.get('/api/schedules/doctor-1')).status, 200);
    assert.equal((await rao.get('/api/patients/patient-2')).status, 403);
    assert.equal((await rao.get('/api/patients/patient-1')).json.phone, '+1 *** *** 1234');
    assert.equal((await rao.get('/api/reports/daily?date=2026-11-19')).status, 403);

    assert.equal((await admin.post('/api/staff/logout')).status, 200);
    assert.equal((await admin.get('/api/staff/me')).status, 401);
  });

  it('CB_BACK_AFTER_LOGOUT off: back office pages and APIs are never cached', async () => {
    const c = app.client();
    assert.equal((await c.get('/admin/appointments')).headers.get('cache-control'), 'no-store');
    assert.equal((await c.get('/api/staff/me')).headers.get('cache-control'), 'no-store');
    assert.equal((await c.get('/api/patient/me')).headers.get('cache-control'), null);
  });

  it('session expiry returns 401 with expired true after the clock moves', async () => {
    const c = app.client();
    await login(c, 'admin@clinicbook.test');
    assert.equal((await c.post('/api/dev/clock', { advanceMinutes: 31 })).status, 200);
    const expired = await c.get('/api/staff/me');
    assert.equal(expired.status, 401);
    assert.equal(expired.json.expired, true);
    assert.equal(expired.json.error, 'Seans muddati tugadi. Iltimos, qaytadan kiring.');
    await c.post('/api/dev/clock', { now: '2026-11-19T13:10' });
  });

  it('dev tools: clock, reset, outbox', async () => {
    const c = app.client();
    assert.equal((await c.get('/api/dev/clock')).json.time, '13:10');
    assert.equal((await c.post('/api/dev/clock', { now: '2026-11-19T10:00' })).json.time, '10:00');
    assert.equal((await c.post('/api/dev/clock', { now: 'garbage' })).status, 400);
    assert.equal((await c.post('/api/dev/clock', {})).status, 400);
    assert.equal((await c.post('/api/dev/clock', { now: '2026-11-19T13:10' })).json.time, '13:10');

    await c.post('/api/patient/login', { email: 'amina.patient@example.com', password: TEST_PASSWORD });
    await c.post('/api/bookings', { doctorId: 'doctor-1', date: '2026-11-20', time: '10:30', reason: 'Mail test <b>' });
    assert.equal((await c.get('/api/dev/outbox')).json[0].to, 'amina.patient@example.com');
    const page = await c.get('/dev/outbox');
    assert.match(page.text, /Sizning ClinicBook qabulingiz/);
    assert.ok(!page.text.includes('<b>'), 'html is escaped');
    assert.equal((await c.post('/api/dev/reset')).status, 200);
    assert.match((await c.get('/dev/outbox')).text, /Hozircha xat yuborilmagan/);
    assert.equal((await c.get('/api/doctors/doctor-1/slots?date=2026-11-20')).json.times.includes('10:30'), true, 'reset restored the seed data');
  });

  it('maps errors: bad JSON, unknown API route, unexpected failure', async () => {
    const c = app.client();
    assert.equal((await c.raw('POST', '/api/patient/register', '{not json')).status, 400);
    assert.equal((await c.get('/api/nothing-here')).status, 404);
    const original = console.error;
    console.error = () => {};
    const doctors = app.app.locals.services.doctors;
    const list = doctors.list;
    doctors.list = () => { throw new Error('boom'); };
    const failed = await c.get('/api/doctors');
    doctors.list = list;
    console.error = original;
    assert.equal(failed.status, 500);
    assert.equal(failed.json.error, 'Xatolik yuz berdi');
  });
});

describe('HTTP API (build with all seeded defects)', () => {
  let app;
  before(async () => { app = await startApp(createDefects('on')); });
  after(() => app.close());

  it('CB_BACK_AFTER_LOGOUT on: protected pages and APIs are cacheable for an hour', async () => {
    const c = app.client();
    assert.equal((await c.get('/admin/appointments')).headers.get('cache-control'), 'private, max-age=3600');
    assert.equal((await c.get('/api/staff/me')).headers.get('cache-control'), 'private, max-age=3600');
  });

  it('seeded behavior through HTTP: receptionist dashboard, unknown email, export, unmasked phone, other schedule', async () => {
    const c = app.client();
    assert.equal((await c.post('/api/staff/login', { email: 'nobody@clinicbook.test', password: 'x' })).json.error, 'Bunday email topilmadi');
    const reception = app.client();
    await login(reception, 'reception@clinicbook.test');
    assert.equal((await reception.get('/api/dashboard')).status, 200);
    const csv = await reception.get('/api/reports/daily?date=2026-11-19');
    assert.equal(csv.status, 200);
    assert.equal(csv.headers.get('content-disposition'), 'attachment; filename="appointments-19-11-2026.csv"');
    const rao = app.client();
    await login(rao, 'doctor.rao@clinicbook.test');
    assert.equal((await rao.get('/api/patients/patient-2')).status, 200);
    assert.equal((await rao.get('/api/patients/patient-1')).json.phone, '+1 555 010 1234');
    assert.equal((await rao.get('/api/schedules/doctor-2')).status, 200);
    assert.equal((await reception.get('/api/admin/appointments?from=2026-11-19&to=2026-11-20')).json.total, 8);
  });
});
