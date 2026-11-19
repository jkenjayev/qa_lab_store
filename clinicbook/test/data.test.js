import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIALTIES, createSeed } from '../src/data/seed.js';
import { createRepositories } from '../src/data/repositories.js';

const seed = () => createSeed({ passwordHash: 'hash' });

describe('seed data (matches the Notion test data)', () => {
  it('has 12 doctors, 8 specialties and the experience years of the walkthroughs', () => {
    const { doctors } = seed();
    assert.equal(doctors.length, 12);
    assert.equal(SPECIALTIES.length, 8);
    assert.deepEqual(doctors.map((d) => d.years).sort((a, b) => a - b), [2, 3, 6, 6, 9, 9, 11, 12, 14, 15, 18, 22]);
    assert.deepEqual(doctors.find((d) => d.id === 'doctor-1'), { id: 'doctor-1', name: 'Dr. A. Rao', specialty: 'Kardiologiya', years: 14 });
    assert.equal(doctors.find((d) => d.name === 'Dr. L. Kim').specialty, 'Dermatologiya');
    assert.equal(doctors.find((d) => d.name === 'Dr. S. Roy').years, 9);
  });
  it('Dr. Rao works Mon-Ju 09:00-17:00 in 30-minute slots, Sunday off', () => {
    const { schedules } = seed();
    const rao = schedules['doctor-1'];
    assert.equal(rao.slotMinutes, 30);
    assert.deepEqual(rao.days[1], { off: false, start: '09:00', end: '17:00' });
    assert.equal(rao.days[0].off, true);
    assert.equal(rao.days[6].off, true);
  });
  it('has 57 appointments from 10 Noy to 05 Dek 2026 with unique references', () => {
    const { appointments } = seed();
    const dates = appointments.map((a) => a.date).sort();
    assert.equal(appointments.length, 57);
    assert.equal(dates[0], '2026-11-10');
    assert.equal(dates.at(-1), '2026-12-05');
    assert.equal(new Set(appointments.map((a) => a.reference)).size, 57);
  });
  it('19 Noy has 8 appointments, 21 Noy none, Rao only has 10:30 today and 10:00 on Monday', () => {
    const { appointments } = seed();
    assert.equal(appointments.filter((a) => a.date === '2026-11-19').length, 8);
    assert.equal(appointments.filter((a) => a.date === '2026-11-21').length, 0);
    assert.ok(appointments.filter((a) => a.date === '2026-11-20').length >= 2);
    const raoUpcoming = appointments.filter((a) => a.doctorId === 'doctor-1' && a.date >= '2026-11-19');
    assert.deepEqual(raoUpcoming.map((a) => `${a.date} ${a.time}`), ['2026-11-19 10:30', '2026-11-23 10:00']);
  });
  it('Amina has 12 visits, CB-304530 today 12:00 and CB-304511 on Monday; Bilal has nothing', () => {
    const { appointments, patients } = seed();
    const amina = patients.find((p) => p.id === 'patient-1');
    assert.equal(amina.dob, '1990-03-14');
    assert.equal(amina.phone, '+1 555 010 1234');
    assert.equal(appointments.filter((a) => a.patientId === 'patient-1' && a.date < '2026-11-19').length, 12);
    assert.equal(appointments.find((a) => a.reference === 'CB-304530').time, '12:00');
    assert.equal(appointments.find((a) => a.reference === 'CB-304511').date, '2026-11-23');
    assert.equal(appointments.filter((a) => a.patientId === 'patient-2').length, 0);
  });
  it('has the three staff accounts', () => {
    const { staff } = seed();
    assert.deepEqual(staff.map((s) => s.email), ['admin@clinicbook.test', 'reception@clinicbook.test', 'doctor.rao@clinicbook.test']);
    assert.equal(staff[2].doctorId, 'doctor-1');
  });
});

describe('repositories', () => {
  const repos = () => createRepositories(seed(), (() => { let n = 0; return () => `token-${++n}`; })());

  it('looks things up and returns null when missing', () => {
    const r = repos();
    assert.equal(r.doctors.get('doctor-1').name, 'Dr. A. Rao');
    assert.equal(r.doctors.get('nope'), null);
    assert.equal(r.doctors.list().length, 12);
    assert.equal(r.schedules.get('nope'), null);
    assert.equal(r.appointments.get('nope'), null);
    assert.equal(r.patients.get('nope'), null);
    assert.equal(r.staff.get('nope'), null);
    assert.equal(r.staff.findByEmail(' Admin@ClinicBook.test ').role, 'Admin');
  });
  it('stores schedules and finds patients by email exactly or ignoring case', () => {
    const r = repos();
    r.schedules.set('doctor-1', { slotMinutes: 15, days: {} });
    assert.equal(r.schedules.get('doctor-1').slotMinutes, 15);
    assert.ok(r.patients.findByEmailExact('bilal.hassan@example.com'));
    assert.equal(r.patients.findByEmailExact('Bilal.Hassan@example.com'), null);
    assert.ok(r.patients.findByEmailIgnoreCase('Bilal.Hassan@example.com'));
    assert.equal(r.patients.list().length, 8);
    assert.equal(r.patients.add({ fullName: 'N', email: 'n@x.co' }).id, 'patient-9');
  });
  it('hands out references 304517, 304520, ... and adds appointments', () => {
    const r = repos();
    assert.equal(r.appointments.nextReference(), 'CB-304517');
    assert.equal(r.appointments.nextReference(), 'CB-304520');
    r.appointments.add({ reference: 'CB-1' });
    assert.equal(r.appointments.get('CB-1').reference, 'CB-1');
  });
  it('keeps sessions, login attempts and the outbox', () => {
    const r = repos();
    assert.equal(r.patientSessions.get(undefined), null);
    const token = r.staffSessions.create({ staffId: 'staff-1' }, 100);
    assert.equal(r.staffSessions.get(token).lastActivity, 100);
    r.staffSessions.touch(token, 150);
    assert.equal(r.staffSessions.get(token).lastActivity, 150);
    r.staffSessions.touch('missing', 1);
    r.staffSessions.remove(token);
    assert.equal(r.staffSessions.get(token), null);
    r.attempts.get('a').count = 3;
    assert.equal(r.attempts.get('a').count, 3);
    r.attempts.reset('a');
    assert.equal(r.attempts.get('a').count, 0);
    r.outbox.add({ subject: 'first' });
    r.outbox.add({ subject: 'second' });
    assert.deepEqual(r.outbox.list().map((m) => m.subject), ['second', 'first']);
  });
});
