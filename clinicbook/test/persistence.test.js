import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDefects, onlyDefects } from '../src/defects.js';
import { runSeed } from '../src/storage/commands.js';
import { createStorage } from '../src/storage/createStorage.js';
import { WriteQueue } from '../src/storage/WriteQueue.js';
import { ALL_TITLES, FakeNotionGateway } from './fakeGateway.js';
import { TEST_PASSWORD, startApp } from './helpers.js';

const silent = () => {};
const env = { NOTION_TOKEN: 'placeholder' };
const fastQueue = () => new WriteQueue({ minIntervalMs: 0, baseDelayMs: 1, sleep: async () => {} });

async function seededGateway() {
  const gateway = new FakeNotionGateway({ titles: ALL_TITLES });
  await runSeed({ env, gatewayFactory: () => gateway, queue: fastQueue(), log: silent });
  return gateway;
}
const openStorage = (gateway) => createStorage({ env, trainingPassword: TEST_PASSWORD, gatewayFactory: () => gateway, queue: fastQueue(), log: silent });

async function start(gateway, defects = createDefects('off')) {
  const storage = await openStorage(gateway);
  const running = await startApp(defects, '2026-11-19T13:10:00', storage);
  return { ...running, storage };
}

const PATIENT = { fullName: 'Stored Patient', email: 'stored@example.com', phone: '+1 555 010 9999', dob: '1990-01-01', password: 'Abcdef12', confirmPassword: 'Abcdef12' };

describe('Notion write-through storage', () => {
  it('starts from the rows stored in Notion and reports the storage status', async () => {
    const gateway = await seededGateway();
    const { client, close, storage } = await start(gateway);
    try {
      const c = client();
      assert.equal((await c.get('/api/doctors')).json.length, 12);
      const status = (await c.get('/api/dev/storage')).json;
      assert.equal(status.mode, 'notion');
      assert.equal(status.pending, 0);
      assert.equal(storage.initialData.appointments.length, 57);
      assert.ok(storage.initialData.patients.every((p) => typeof p.passwordHash === 'string'), 'shared hash restored from the environment');
    } finally {
      await close();
    }
  });

  it('writes registrations, bookings, emails, status changes and schedules to Notion', async () => {
    const gateway = await seededGateway();
    const { client, close, storage } = await start(gateway, createDefects('off'));
    try {
      const c = client();
      assert.equal((await c.post('/api/patient/register', PATIENT)).status, 201);
      assert.equal((await c.post('/api/patient/login', { email: PATIENT.email, password: PATIENT.password })).status, 200);
      const booked = await c.post('/api/bookings', { doctorId: 'doctor-1', date: '2026-12-01', time: '09:00', reason: 'Tekshiruv' });
      assert.equal(booked.status, 201);
      const reference = booked.json.reference;
      assert.equal((await c.post(`/api/appointments/${reference}/cancel`)).status, 200);

      const admin = client();
      await admin.post('/api/staff/login', { email: 'admin@clinicbook.test', password: TEST_PASSWORD });
      const schedule = await admin.get('/api/schedules/doctor-2');
      const days = { ...schedule.json.schedule.days, 1: { off: false, start: '11:00', end: '16:00' } };
      assert.equal((await admin.put('/api/schedules/doctor-2', { slotMinutes: 30, days })).status, 200);
      await storage.flush();

      const patients = gateway.rows('CB Patients');
      assert.equal(patients['patient-9'].email, PATIENT.email);
      assert.match(patients['patient-9'].passwordHash, /^[0-9a-f]+:[0-9a-f]+$/, 'own password hash is stored');
      assert.equal(gateway.rows('CB Patients')['patient-1'].passwordHash, null, 'seed patients keep the shared password out of Notion');
      assert.equal(gateway.rows('CB Appointments')[reference].status, 'Cancelled');
      assert.equal(Object.keys(gateway.rows('CB Emails')).length, 1);
      assert.match(Object.values(gateway.rows('CB Emails'))[0].subject, new RegExp(reference));
      assert.equal(gateway.rows('CB Schedules')['doctor-2'].schedule.days[1].start, '11:00');
      assert.equal(storage.status().pending, 0);
    } finally {
      await close();
    }
  });

  it('keeps data across a restart: login, next booking number and emails continue', async () => {
    const gateway = await seededGateway();
    const first = await start(gateway);
    let firstReference;
    try {
      const c = first.client();
      await c.post('/api/patient/register', PATIENT);
      await c.post('/api/patient/login', { email: PATIENT.email, password: PATIENT.password });
      firstReference = (await c.post('/api/bookings', { doctorId: 'doctor-1', date: '2026-12-01', time: '09:00', reason: 'Birinchi' })).json.reference;
      await first.storage.flush();
    } finally {
      await first.close();
    }

    const second = await start(gateway);
    try {
      const c = second.client();
      assert.equal((await c.post('/api/patient/login', { email: PATIENT.email, password: PATIENT.password })).status, 200);
      const nextReference = (await c.post('/api/bookings', { doctorId: 'doctor-1', date: '2026-12-02', time: '09:00', reason: 'Ikkinchi' })).json.reference;
      assert.notEqual(nextReference, firstReference);
      assert.equal(Number(nextReference.slice(3)) - Number(firstReference.slice(3)), 3);
      const seedPatient = second.client();
      assert.equal((await seedPatient.post('/api/patient/login', { email: 'amina.patient@example.com', password: TEST_PASSWORD })).status, 200, 'seed patients sign in with the training password');
      const staff = second.client();
      assert.equal((await staff.post('/api/staff/login', { email: 'doctor.rao@clinicbook.test', password: TEST_PASSWORD })).status, 200);
      assert.equal((await second.client().get('/api/dev/outbox')).json.length, 2);
    } finally {
      await second.close();
    }
  });

  it('reset restores the seed in memory at once and in Notion after the queue drains', async () => {
    const gateway = await seededGateway();
    const { client, close, storage } = await start(gateway);
    try {
      const c = client();
      await c.post('/api/patient/register', PATIENT);
      await c.post('/api/patient/login', { email: PATIENT.email, password: PATIENT.password });
      await c.post('/api/bookings', { doctorId: 'doctor-1', date: '2026-12-01', time: '09:00', reason: 'Vaqtinchalik' });
      await storage.flush();
      assert.equal(Object.keys(gateway.rows('CB Patients')).length, 9);
      assert.equal(Object.keys(gateway.rows('CB Emails')).length, 1);

      assert.equal((await c.post('/api/dev/reset')).status, 200);
      assert.equal((await c.get('/api/dev/outbox')).json.length, 0, 'memory is reset at once');
      await storage.flush();
      assert.equal(Object.keys(gateway.rows('CB Patients')).length, 8);
      assert.equal(Object.keys(gateway.rows('CB Appointments')).length, 57);
      assert.equal(Object.keys(gateway.rows('CB Emails')).length, 0);
    } finally {
      await close();
    }
  });

  it('a failing Notion write never breaks the request and shows up in the storage status', async () => {
    const gateway = await seededGateway();
    const { client, close, storage } = await start(gateway);
    try {
      gateway.failures.createRow = { count: 1, status: 400, message: 'rejected by Notion' };
      const c = client();
      assert.equal((await c.post('/api/patient/register', PATIENT)).status, 201);
      await storage.flush();
      const status = (await c.get('/api/dev/storage')).json;
      assert.match(status.lastError.message, /rejected by Notion/);
      assert.equal(status.pending, 0);
    } finally {
      await close();
    }
  });

  it('persists appointments that a defect orphans or releases', async () => {
    const gateway = await seededGateway();
    const { client, close, storage } = await start(gateway, onlyDefects('CB_SCHEDULE_ORPHANS_APPOINTMENTS', 'CB_RESCHEDULE_FREES_EARLY'));
    try {
      const admin = client();
      await admin.post('/api/staff/login', { email: 'admin@clinicbook.test', password: TEST_PASSWORD });
      const days = (await admin.get('/api/schedules/doctor-1')).json.schedule.days;
      await admin.put('/api/schedules/doctor-1', { slotMinutes: 30, days: { ...days, 1: { off: false, start: '09:00', end: '09:30' } } });
      await storage.flush();
      assert.equal(gateway.rows('CB Appointments')['CB-304511'].status, 'Orphaned');

      const patient = client();
      await patient.post('/api/patient/login', { email: 'amina.patient@example.com', password: TEST_PASSWORD });
      assert.equal((await patient.post('/api/appointments/CB-304530/reschedule-start')).status, 200);
      await storage.flush();
      assert.equal(gateway.rows('CB Appointments')['CB-304530'].status, 'Released');
    } finally {
      await close();
    }
  });

  it('reschedules and persists the new date and time', async () => {
    const gateway = await seededGateway();
    const { client, close, storage } = await start(gateway);
    try {
      const patient = client();
      await patient.post('/api/patient/login', { email: 'amina.patient@example.com', password: TEST_PASSWORD });
      const res = await patient.post('/api/appointments/CB-304511/reschedule', { date: '2026-11-24', time: '10:00' });
      assert.equal(res.status, 200);
      await storage.flush();
      assert.deepEqual([gateway.rows('CB Appointments')['CB-304511'].date, gateway.rows('CB Appointments')['CB-304511'].time], ['2026-11-24', '10:00']);
    } finally {
      await close();
    }
  });
});
