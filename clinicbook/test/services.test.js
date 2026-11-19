import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDefects, onlyDefects } from '../src/defects.js';
import { ConflictError, ForbiddenError, LockedError, NotFoundError, UnauthorizedError, ValidationError } from '../src/domain/errors.js';
import { ADMIN, DR_RAO, RECEPTION, TEST_PASSWORD, makeServices } from './helpers.js';

const off = createDefects('off');
const person = { fullName: 'Test Person', email: 'test.person@example.com', phone: '+1 555 010 9999', dob: '1990-01-01', password: 'Abcdef12', confirmPassword: 'Abcdef12' };

describe('SlotService', () => {
  it('CB_PAST_SLOTS_SHOWN: past slots listed on, hidden off (13:10 on Pa 19 Noy)', () => {
    const on = makeServices(onlyDefects('CB_PAST_SLOTS_SHOWN'));
    const times = on.slots.displayTimes('doctor-1', '2026-11-19');
    assert.equal(times[0], '09:00');
    assert.equal(times.at(-1), '16:30');
    assert.equal(times.length, 15);
    assert.ok(!times.includes('10:30'), 'booked slot is never shown');
    const ref = makeServices(off);
    assert.deepEqual(ref.slots.displayTimes('doctor-1', '2026-11-19'), ['13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']);
  });
  it('validates input and doctors', () => {
    const s = makeServices(off);
    assert.throws(() => s.slots.displayTimes('doctor-1', 'bad'), ValidationError);
    assert.throws(() => s.slots.displayTimes('nope', '2026-11-19'), NotFoundError);
    assert.throws(() => s.slots.freeTimes('nope', '2026-11-19'), NotFoundError);
  });
  it('builds a 7-day strip: Sunday is grey, Roy has no Monday', () => {
    const s = makeServices(off);
    const week = s.slots.week('doctor-1');
    assert.equal(week.length, 7);
    assert.deepEqual(week.map((d) => `${d.weekday} ${d.day}`), ['Pa 19', 'Ju 20', 'Sh 21', 'Ya 22', 'Du 23', 'Se 24', 'Ch 25']);
    assert.deepEqual(week.map((d) => d.hasSlots), [true, true, false, false, true, true, true]);
    assert.equal(s.slots.week('doctor-3')[4].hasSlots, false);
  });
  it('finds the next available day and checks single slots', () => {
    const s = makeServices(off, '2026-11-19T17:30:00');
    assert.equal(s.slots.nextAvailable('doctor-1'), '2026-11-20');
    assert.equal(s.slots.isFree('doctor-1', '2026-11-20', '10:30'), true);
    const noon = makeServices(off);
    assert.equal(noon.slots.isFree('doctor-1', '2026-11-19', '10:30'), false);
    assert.equal(noon.slots.isFree('doctor-1', '2026-11-19', '14:00'), true);
    const none = makeServices(off);
    none.repos.schedules.set('doctor-1', { slotMinutes: 30, days: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { off: true }])) });
    assert.equal(none.slots.nextAvailable('doctor-1'), null);
  });
});

describe('DoctorService', () => {
  it('lists doctors with next available date and initials', () => {
    const s = makeServices(off);
    const rao = s.doctors.list({ name: 'rao' });
    assert.equal(rao.length, 1);
    assert.equal(rao[0].nextAvailable, '2026-11-19');
    assert.equal(rao[0].nextAvailableText, '19 Noy 2026');
    assert.equal(rao[0].initials, 'AR');
    assert.equal(s.doctors.specialties().length, 8);
    assert.equal(s.doctors.get('doctor-2').specialty, 'Dermatologiya');
    assert.throws(() => s.doctors.get('nope'), NotFoundError);
  });
  it('shows "Boʻsh vaqt yoʻq" when a doctor has no availability', () => {
    const s = makeServices(off);
    s.repos.schedules.set('doctor-1', { slotMinutes: 30, days: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { off: true }])) });
    assert.equal(s.doctors.get('doctor-1').nextAvailableText, 'Boʻsh vaqt yoʻq');
  });
  it('CB_DOCTOR_SEARCH_CASE_SENSITIVE and CB_EXPERIENCE_SORT_ASCENDING through the service', () => {
    const on = makeServices(createDefects('on'));
    assert.equal(on.doctors.list({ name: 'rao' }).length, 0);
    assert.equal(on.doctors.list({ name: 'Rao' }).length, 1);
    assert.deepEqual(on.doctors.list({ sort: 'experience' }).map((d) => d.years), [2, 3, 6, 6, 9, 9, 11, 12, 14, 15, 18, 22]);
    const ref = makeServices(off);
    assert.deepEqual(ref.doctors.list({ sort: 'experience' }).map((d) => d.years), [22, 18, 15, 14, 12, 11, 9, 9, 6, 6, 3, 2]);
  });
});

describe('PatientAuthService', () => {
  it('registers a patient and logs in with the shared test password', () => {
    const s = makeServices(off);
    const created = s.patientAuth.register(person);
    assert.equal(created.email, person.email);
    const { token } = s.patientAuth.login('TEST.person@example.com', person.password);
    assert.equal(s.patientAuth.authenticate(token).fullName, 'Test Person');
    s.patientAuth.logout(token);
    assert.throws(() => s.patientAuth.authenticate(token), UnauthorizedError);
    assert.ok(s.patientAuth.login('amina.patient@example.com', TEST_PASSWORD).token);
    assert.throws(() => s.patientAuth.authenticate(undefined), UnauthorizedError);
  });
  it('reports field errors', () => {
    const s = makeServices(off);
    assert.throws(() => s.patientAuth.register({ ...person, password: 'short' }), (e) => e instanceof ValidationError && e.fields.password === 'Parol qoidalarga mos kelmaydi');
  });
  it('CB_PASSWORD_MIN_6: Abc123 creates an account on, is refused off', () => {
    assert.ok(makeServices(onlyDefects('CB_PASSWORD_MIN_6')).patientAuth.register({ ...person, password: 'Abc123', confirmPassword: 'Abc123' }));
    assert.throws(() => makeServices(off).patientAuth.register({ ...person, password: 'Abc123', confirmPassword: 'Abc123' }), ValidationError);
  });
  it('CB_EMAIL_UNIQUE_CASE_SENSITIVE: differently cased email accepted on, refused off; exact duplicate always refused', () => {
    for (const [defects, secondOk] of [[onlyDefects('CB_EMAIL_UNIQUE_CASE_SENSITIVE'), true], [off, false]]) {
      const s = makeServices(defects);
      s.patientAuth.register({ ...person, email: 'Amina@Example.com' });
      const second = () => s.patientAuth.register({ ...person, email: 'amina@example.com' });
      if (secondOk) assert.ok(second());
      else assert.throws(second, (e) => e.fields.email === 'Bu email allaqachon roʻyxatdan oʻtgan');
      assert.throws(() => s.patientAuth.register({ ...person, email: 'Amina@Example.com' }), ValidationError);
    }
  });
  it('CB_FUTURE_DOB_ACCEPTED through registration', () => {
    assert.ok(makeServices(onlyDefects('CB_FUTURE_DOB_ACCEPTED')).patientAuth.register({ ...person, dob: '2030-01-01' }));
    assert.throws(() => makeServices(off).patientAuth.register({ ...person, dob: '2030-01-01' }), (e) => e.fields.dob.includes('kelajakda'));
  });
  it('CB_LOCKOUT_AT_10: locks on the 10th wrong attempt on, on the 5th off', () => {
    for (const [defects, lockAt] of [[onlyDefects('CB_LOCKOUT_AT_10'), 10], [off, 5]]) {
      const s = makeServices(defects);
      for (let i = 1; i < lockAt; i += 1) {
        assert.throws(() => s.patientAuth.login('amina.patient@example.com', 'wrong'), (e) => e instanceof UnauthorizedError && e.message === 'Email yoki parol notoʻgʻri');
      }
      assert.throws(() => s.patientAuth.login('amina.patient@example.com', 'wrong'), (e) => e instanceof LockedError && e.message === 'Urinishlar soni oshib ketdi. 15 daqiqadan keyin qayta urinib koʻring.');
      assert.throws(() => s.patientAuth.login('amina.patient@example.com', TEST_PASSWORD), LockedError, 'still locked with the right password');
      s.clock.advance(15);
      assert.ok(s.patientAuth.login('amina.patient@example.com', TEST_PASSWORD).token);
    }
  });
  it('an unknown email gets the same generic message and a successful login resets the counter', () => {
    const s = makeServices(off);
    assert.throws(() => s.patientAuth.login('nobody@example.com', 'x'), (e) => e.message === 'Email yoki parol notoʻgʻri');
    assert.throws(() => s.patientAuth.login('', 'x'), UnauthorizedError);
    for (let i = 0; i < 3; i += 1) assert.throws(() => s.patientAuth.login('amina.patient@example.com', 'wrong'), UnauthorizedError);
    s.patientAuth.login('amina.patient@example.com', TEST_PASSWORD);
    for (let i = 0; i < 4; i += 1) assert.throws(() => s.patientAuth.login('amina.patient@example.com', 'wrong'), UnauthorizedError);
  });
});

describe('StaffAuthService', () => {
  it('logs in each role and redirects to its start page', () => {
    const s = makeServices(off);
    assert.equal(s.staffAuth.login('admin@clinicbook.test', TEST_PASSWORD).redirect, '/admin/dashboard');
    assert.equal(s.staffAuth.login('reception@clinicbook.test', TEST_PASSWORD).redirect, '/admin/appointments');
    const rao = s.staffAuth.login('doctor.rao@clinicbook.test', TEST_PASSWORD);
    assert.equal(rao.redirect, '/admin/my-schedule');
    assert.equal(s.staffAuth.authenticate(rao.token).doctorId, 'doctor-1');
  });
  it('CB_UNKNOWN_EMAIL_MESSAGE: Bunday email topilmadi on, generic off; wrong password is always generic', () => {
    assert.throws(() => makeServices(onlyDefects('CB_UNKNOWN_EMAIL_MESSAGE')).staffAuth.login('x@y.z', 'p'), (e) => e.message === 'Bunday email topilmadi');
    assert.throws(() => makeServices(off).staffAuth.login('x@y.z', 'p'), (e) => e.message === 'Email yoki parol notoʻgʻri');
    assert.throws(() => makeServices(onlyDefects('CB_UNKNOWN_EMAIL_MESSAGE')).staffAuth.login('admin@clinicbook.test', 'wrong'), (e) => e.message === 'Email yoki parol notoʻgʻri');
  });
  it('CB_SESSION_60_MIN: still signed in at 45 minutes and expired at 60 on; expired at 30 off', () => {
    const on = makeServices(onlyDefects('CB_SESSION_60_MIN'));
    const { token } = on.staffAuth.login('admin@clinicbook.test', TEST_PASSWORD);
    on.clock.advance(45);
    assert.ok(on.staffAuth.authenticate(token));
    on.clock.advance(60);
    assert.throws(() => on.staffAuth.authenticate(token), (e) => e instanceof UnauthorizedError && e.expired && e.message === 'Seans muddati tugadi. Iltimos, qaytadan kiring.');

    const ref = makeServices(off);
    const login = ref.staffAuth.login('admin@clinicbook.test', TEST_PASSWORD);
    ref.clock.advance(29);
    assert.ok(ref.staffAuth.authenticate(login.token), 'activity refreshes the session');
    ref.clock.advance(30);
    assert.throws(() => ref.staffAuth.authenticate(login.token), (e) => e.expired === true);
  });
  it('rejects missing sessions, logs out, and handles a removed user', () => {
    const s = makeServices(off);
    assert.throws(() => s.staffAuth.authenticate('nope'), UnauthorizedError);
    const { token } = s.staffAuth.login('admin@clinicbook.test', TEST_PASSWORD);
    s.staffAuth.logout(token);
    assert.throws(() => s.staffAuth.authenticate(token), UnauthorizedError);
    const ghost = s.repos.staffSessions.create({ staffId: 'staff-999' }, s.clock.nowMinutes());
    assert.throws(() => s.staffAuth.authenticate(ghost), UnauthorizedError);
  });
});

describe('BookingService', () => {
  const booking = { patientId: 'patient-1', doctorId: 'doctor-1', date: '2026-11-20', time: '10:30', reason: 'Chest pain' };

  it('books a slot, returns reference CB-304517 and sends the email', () => {
    const s = makeServices(off);
    const result = s.booking.book(booking);
    assert.equal(result.reference, 'CB-304517');
    assert.equal(result.confirmationDateText, 'Ju 20 Noy 2026');
    const [mail] = s.repos.outbox.list();
    assert.equal(mail.subject, 'Sizning ClinicBook qabulingiz CB-304517');
    for (const part of ['Qabul raqami: CB-304517', 'Dr. A. Rao', 'Ju 20 Noy 2026', '10:30', '12 Garden Street, Block B', 'Qabulni bekor qilish']) assert.ok(mail.body.includes(part), part);
    assert.equal(s.slots.isFree('doctor-1', '2026-11-20', '10:30'), false);
  });
  it('CB_CONFIRM_DATE_PREV_DAY: confirmation shows Pa 19 Noy on, Ju 20 Noy off (email stays right)', () => {
    const on = makeServices(onlyDefects('CB_CONFIRM_DATE_PREV_DAY'));
    assert.equal(on.booking.book(booking).confirmationDateText, 'Pa 19 Noy 2026');
    assert.ok(on.repos.outbox.list()[0].body.includes('Ju 20 Noy 2026'));
  });
  it('CB_EMAIL_NO_ADDRESS: no address line on, address present off', () => {
    const on = makeServices(onlyDefects('CB_EMAIL_NO_ADDRESS'));
    on.booking.book(booking);
    assert.ok(!on.repos.outbox.list()[0].body.includes('Garden Street'));
  });
  it('CB_EMPTY_REASON_ACCEPTED: empty reason books on, is refused off; 200 characters max', () => {
    assert.ok(makeServices(onlyDefects('CB_EMPTY_REASON_ACCEPTED')).booking.book({ ...booking, reason: '' }));
    assert.throws(() => makeServices(off).booking.book({ ...booking, reason: '  ' }), (e) => e.message === 'Qabulga kelish sababini yozing');
    assert.throws(() => makeServices(off).booking.book({ ...booking, reason: 'x'.repeat(201) }), ValidationError);
  });
  it('CB_SAME_DAY_DOUBLE_BOOKING: a second booking for the same doctor and day gets CB-304520 on, is refused off', () => {
    const second = { ...booking, time: '14:00' };
    const on = makeServices(onlyDefects('CB_SAME_DAY_DOUBLE_BOOKING'));
    on.booking.book(booking);
    assert.equal(on.booking.book(second).reference, 'CB-304520');
    const ref = makeServices(off);
    ref.booking.book(booking);
    assert.throws(() => ref.booking.book(second), (e) => e instanceof ConflictError && e.message === 'Siz bu kuni ushbu shifokorga allaqachon yozilgansiz');
  });
  it('refuses a slot that was taken meanwhile and bad input', () => {
    const s = makeServices(off);
    s.booking.book(booking);
    assert.throws(() => s.booking.book({ ...booking, patientId: 'patient-3' }), (e) => e instanceof ConflictError && e.message === 'Bu vaqt endi band. Iltimos, boshqa vaqtni tanlang.');
    assert.throws(() => s.booking.book({ ...booking, doctorId: 'nope' }), NotFoundError);
    assert.throws(() => s.booking.book({ ...booking, patientId: 'nope' }), NotFoundError);
    assert.throws(() => s.booking.book({ ...booking, date: 'x' }), ValidationError);
    assert.throws(() => s.booking.book({ ...booking, date: '2026-11-18', time: '10:00', patientId: 'patient-3' }), ConflictError, 'past slots cannot be booked');
  });
});

describe('PatientAppointmentService', () => {
  const at10 = '2026-11-19T10:00:00';

  it('lists upcoming appointments nearest first and the rest as past', () => {
    const s = makeServices(off, at10);
    const mine = s.myAppointments.listMine('patient-1');
    assert.deepEqual(mine.upcoming.map((a) => a.reference), ['CB-304530', 'CB-304511']);
    assert.equal(mine.past.length, 12);
    assert.equal(mine.upcoming[0].doctorName, 'Dr. L. Kim');
  });
  it('CB_NO_CANCEL_CUTOFF: cancelling 2 hours before start works on, is refused off', () => {
    const on = makeServices(onlyDefects('CB_NO_CANCEL_CUTOFF'), at10);
    assert.equal(on.myAppointments.cancel('patient-1', 'CB-304530').status, 'Cancelled');
    const ref = makeServices(off, at10);
    assert.throws(() => ref.myAppointments.cancel('patient-1', 'CB-304530'), (e) => e instanceof ConflictError && e.message.includes('24 soatdan'));
    assert.equal(ref.myAppointments.cancel('patient-1', 'CB-304511').status, 'Cancelled');
    assert.ok(ref.myAppointments.listMine('patient-1').past.some((a) => a.reference === 'CB-304511' && a.status === 'Cancelled'));
  });
  it('only the owner can act and only booked appointments can be cancelled', () => {
    const s = makeServices(off, at10);
    assert.throws(() => s.myAppointments.cancel('patient-3', 'CB-304511'), ForbiddenError);
    assert.throws(() => s.myAppointments.cancel('patient-1', 'CB-9'), NotFoundError);
    s.myAppointments.cancel('patient-1', 'CB-304511');
    assert.throws(() => s.myAppointments.cancel('patient-1', 'CB-304511'), ConflictError);
    assert.throws(() => s.myAppointments.rescheduleStart('patient-1', 'CB-304511'), ConflictError);
    assert.throws(() => s.myAppointments.reschedule('patient-1', 'CB-304511', { date: '2026-11-24', time: '10:00' }), ConflictError);
  });
  it('CB_RESCHEDULE_FREES_EARLY: opening the picker releases the slot and drops the appointment on, nothing happens off', () => {
    const on = makeServices(onlyDefects('CB_RESCHEDULE_FREES_EARLY'), at10);
    assert.deepEqual(on.myAppointments.rescheduleStart('patient-1', 'CB-304530'), { doctorId: 'doctor-2', reference: 'CB-304530' });
    assert.equal(on.slots.isFree('doctor-2', '2026-11-19', '12:00'), true);
    const mine = on.myAppointments.listMine('patient-1');
    assert.ok(![...mine.upcoming, ...mine.past].some((a) => a.reference === 'CB-304530'));

    const ref = makeServices(off, at10);
    ref.myAppointments.rescheduleStart('patient-1', 'CB-304530');
    assert.equal(ref.slots.isFree('doctor-2', '2026-11-19', '12:00'), false);
    assert.equal(ref.myAppointments.listMine('patient-1').upcoming.length, 2);
  });
  it('reschedule moves the appointment only after a free slot is confirmed', () => {
    const s = makeServices(off, at10);
    assert.throws(() => s.myAppointments.reschedule('patient-1', 'CB-304511', { date: '2026-11-19', time: '10:30' }), (e) => e instanceof ConflictError && e.message.includes('endi band'));
    const moved = s.myAppointments.reschedule('patient-1', 'CB-304511', { date: '2026-11-24', time: '10:00' });
    assert.equal(moved.date, '2026-11-24');
    assert.equal(s.slots.isFree('doctor-1', '2026-11-23', '10:00'), true, 'old slot is free only now');
    assert.throws(() => s.myAppointments.reschedule('patient-1', 'CB-304511', { date: 'bad', time: '10:00' }), ValidationError);
  });
});

describe('ScheduleService', () => {
  const clone = (schedule) => JSON.parse(JSON.stringify(schedule));

  it('returns the schedule with upcoming booked appointments (admin also gets the doctor list)', () => {
    const s = makeServices(off);
    const data = s.schedules.get(ADMIN, 'doctor-1');
    assert.equal(data.doctor.name, 'Dr. A. Rao');
    assert.equal(data.doctors.length, 12);
    assert.deepEqual(data.appointments.map((a) => a.reference), ['CB-304498', 'CB-304511']);
    assert.equal(s.schedules.get(DR_RAO, 'doctor-1').doctors, undefined);
    assert.throws(() => s.schedules.get(ADMIN, 'nope'), NotFoundError);
    assert.throws(() => s.schedules.get(RECEPTION, 'doctor-1'), ForbiddenError);
  });
  it('CB_DOCTOR_EDITS_OTHER_SCHEDULE: a doctor reads and saves another schedule on, gets Forbidden off', () => {
    const on = makeServices(onlyDefects('CB_DOCTOR_EDITS_OTHER_SCHEDULE'));
    const kim = on.schedules.get(DR_RAO, 'doctor-2');
    const body = clone(kim.schedule);
    body.days[1].end = '17:30';
    assert.equal(on.schedules.save(DR_RAO, 'doctor-2', body).schedule.days[1].end, '17:30');
    const ref = makeServices(off);
    assert.throws(() => ref.schedules.get(DR_RAO, 'doctor-2'), ForbiddenError);
    assert.throws(() => ref.schedules.save(DR_RAO, 'doctor-2', body), ForbiddenError);
    assert.ok(ref.schedules.get(DR_RAO, 'doctor-1'));
  });
  it('CB_SCHEDULE_EQUAL_TIMES: 09:00-09:00 saves on, is refused off; end before start always refused', () => {
    const body = (end) => { const b = clone(makeServices(off).schedules.get(ADMIN, 'doctor-1').schedule); b.days[1] = { off: false, start: '09:00', end }; return b; };
    const on = makeServices(onlyDefects('CB_SCHEDULE_EQUAL_TIMES'));
    assert.ok(on.schedules.save(ADMIN, 'doctor-1', body('09:00')));
    assert.equal(on.schedules.get(ADMIN, 'doctor-1').appointments.length, 2, 'no side effects of a zero-length window');
    const ref = makeServices(off);
    assert.throws(() => ref.schedules.save(ADMIN, 'doctor-1', body('09:00')), (e) => e instanceof ValidationError && e.message === 'Tugash vaqti boshlanish vaqtidan keyin boʻlishi kerak');
    assert.throws(() => ref.schedules.save(ADMIN, 'doctor-1', body('08:00')), ValidationError);
    assert.throws(() => on.schedules.save(ADMIN, 'doctor-1', body('08:00')), ValidationError);
  });
  it('validates slot length, day settings and times', () => {
    const s = makeServices(off);
    const good = clone(s.schedules.get(ADMIN, 'doctor-1').schedule);
    assert.throws(() => s.schedules.save(ADMIN, 'doctor-1', { ...good, slotMinutes: 20 }), ValidationError);
    assert.throws(() => s.schedules.save(ADMIN, 'doctor-1', { slotMinutes: 30, days: {} }), ValidationError);
    const bad = clone(good);
    bad.days[2] = { off: false, start: '', end: '10:00' };
    assert.throws(() => s.schedules.save(ADMIN, 'doctor-1', bad), (e) => e.message === 'Boshlanish va tugash vaqtini kiriting');
    const off2 = clone(good);
    off2.days[3] = { off: true };
    off2.slotMinutes = 15;
    assert.equal(s.schedules.save(ADMIN, 'doctor-1', off2).schedule.slotMinutes, 15);
  });
  it('CB_SCHEDULE_ORPHANS_APPOINTMENTS: shortening hours drops the appointment silently on; off warns, confirm keeps it', () => {
    const shorten = (s) => { const b = clone(s.schedules.get(ADMIN, 'doctor-1').schedule); b.days[1].end = '09:30'; return b; };
    const on = makeServices(onlyDefects('CB_SCHEDULE_ORPHANS_APPOINTMENTS'));
    const saved = on.schedules.save(ADMIN, 'doctor-1', shorten(on));
    assert.deepEqual(saved.appointments.map((a) => a.reference), ['CB-304498']);
    assert.equal(on.repos.appointments.get('CB-304511').status, 'Orphaned');
    assert.equal(on.adminAppointments.list({}).total, 56, 'the orphaned appointment vanished from the list');

    const ref = makeServices(off);
    assert.throws(() => ref.schedules.save(ADMIN, 'doctor-1', shorten(ref)), (e) => e instanceof ConflictError && e.details.conflicts[0].reference === 'CB-304511' && e.details.conflicts[0].patient === 'Patient, Amina');
    assert.equal(ref.repos.appointments.get('CB-304511').status, 'Booked');
    ref.schedules.save(ADMIN, 'doctor-1', shorten(ref), { confirm: true });
    assert.equal(ref.repos.appointments.get('CB-304511').status, 'Booked');
    assert.equal(ref.schedules.get(ADMIN, 'doctor-1').schedule.days[1].end, '09:30');
  });
});

describe('AdminAppointmentService', () => {
  it('counts 57 appointments and filters like the table does', () => {
    const s = makeServices(off);
    assert.equal(s.adminAppointments.list({}).total, 57);
    assert.equal(s.adminAppointments.list({ from: '2026-11-19', to: '2026-11-19' }).total, 8);
    assert.equal(s.adminAppointments.list({ from: '2026-11-19', to: '2026-11-20' }).total, 11);
    assert.equal(s.adminAppointments.list({ doctorId: 'doctor-2', status: 'Booked' }).rows.every((r) => r.doctor === 'Dr. L. Kim'), true);
  });
  it('seeded defects show in the real data: default range, end date, text sort, counter', () => {
    const on = makeServices(createDefects('on'));
    assert.equal(on.adminAppointments.list({ from: '2026-11-19', to: '2026-11-20' }).total, 8);
    assert.match(on.adminAppointments.list({ sort: 'date' }).rows[0].dateText, /Dek 2026$/, 'December rows sort before November rows');
    assert.equal(on.adminAppointments.list({}).counter, '20 tadan 1-20 koʻrsatilmoqda');
    assert.equal(on.adminAppointments.list({ page: 2 }).counter, '20 tadan 21-40 koʻrsatilmoqda');
    assert.equal(makeServices(off).adminAppointments.list({}).counter, '57 tadan 1-20 koʻrsatilmoqda');
    assert.equal(makeServices(off).adminAppointments.list({ sort: 'date' }).rows[0].dateText, '10 Noy 2026');
  });
});

describe('PatientRecordService', () => {
  it('CB_AGE_ROUNDED_UP, CB_HISTORY_OLDEST_FIRST: Amina is 37 with the oldest 10 visits on, 36 newest first off', () => {
    const on = makeServices(createDefects('on')).patientRecords.get(ADMIN, 'patient-1');
    assert.equal(on.age, 37);
    assert.equal(on.visits[0].date, '10 Noy 2026');
    assert.equal(on.visits.length, 10);
    assert.equal(on.hasMore, true);
    const ref = makeServices(off).patientRecords.get(ADMIN, 'patient-1');
    assert.equal(ref.age, 36);
    assert.equal(ref.visits[0].date, '18 Noy 2026');
    assert.equal(ref.totalVisits, 12);
    assert.equal(ref.dob, '14 Mar 1990');
    assert.equal(makeServices(off).patientRecords.get(ADMIN, 'patient-1', { all: true }).visits.length, 12);
    assert.equal(makeServices(off).patientRecords.get(ADMIN, 'patient-1', { all: true }).hasMore, false);
  });
  it('a patient without visits has an empty history', () => {
    const bilal = makeServices(off).patientRecords.get(ADMIN, 'patient-2');
    assert.deepEqual(bilal.visits, []);
    assert.equal(bilal.hasMore, false);
    assert.throws(() => makeServices(off).patientRecords.get(ADMIN, 'nope'), NotFoundError);
  });
  it('CB_PHONE_NOT_MASKED: doctor sees the full phone on, masked off; receptionist always full', () => {
    assert.equal(makeServices(onlyDefects('CB_PHONE_NOT_MASKED')).patientRecords.get(DR_RAO, 'patient-1').phone, '+1 555 010 1234');
    assert.equal(makeServices(off).patientRecords.get(DR_RAO, 'patient-1').phone, '+1 *** *** 1234');
    assert.equal(makeServices(off).patientRecords.get(RECEPTION, 'patient-1').phone, '+1 555 010 1234');
  });
  it('CB_DOCTOR_OPENS_ANY_PATIENT: Dr. Rao opens Bilal on, gets Forbidden off', () => {
    assert.equal(makeServices(onlyDefects('CB_DOCTOR_OPENS_ANY_PATIENT')).patientRecords.get(DR_RAO, 'patient-2').fullName, 'Bilal Hassan');
    assert.throws(() => makeServices(off).patientRecords.get(DR_RAO, 'patient-2'), ForbiddenError);
    assert.ok(makeServices(off).patientRecords.get(DR_RAO, 'patient-1'));
  });
});

describe('ReportService and DashboardService', () => {
  it('exports 19 Noy with 8 rows and the header', () => {
    const file = makeServices(off).reports.dailyCsv(ADMIN, '2026-11-19');
    const lines = file.content.trim().split('\n');
    assert.equal(lines[0], 'ClinicBook - Kunlik qabullar - 19 Noy 2026');
    assert.equal(lines[1], 'Vaqt,Bemor,Shifokor,Holat');
    assert.equal(lines.length, 2 + 8);
    assert.equal(file.filename, 'appointments-2026-11-19.csv');
    assert.match(file.contentType, /text\/csv/);
  });
  it('CB_CSV_COMMAS_UNQUOTED and CB_CSV_NAME_DD_MM_YYYY through the export', () => {
    const on = makeServices(createDefects('on')).reports.dailyCsv(ADMIN, '2026-11-19');
    assert.ok(on.content.includes('12:00,Patient, Amina,Dr. L. Kim,Band qilingan'));
    assert.equal(on.filename, 'appointments-19-11-2026.csv');
    assert.ok(makeServices(off).reports.dailyCsv(ADMIN, '2026-11-19').content.includes('12:00,"Patient, Amina",Dr. L. Kim,Band qilingan'));
  });
  it('an empty day still exports a file with Qabullar yoʻq', () => {
    assert.match(makeServices(off).reports.dailyCsv(ADMIN, '2026-11-21').content, /Qabullar yoʻq\n$/);
  });
  it('CB_RECEPTION_SEES_EXPORT: receptionist exports on, Forbidden off; doctors never', () => {
    assert.ok(makeServices(onlyDefects('CB_RECEPTION_SEES_EXPORT')).reports.dailyCsv(RECEPTION, '2026-11-19'));
    assert.throws(() => makeServices(off).reports.dailyCsv(RECEPTION, '2026-11-19'), ForbiddenError);
    assert.throws(() => makeServices(createDefects('on')).reports.dailyCsv(DR_RAO, '2026-11-19'), ForbiddenError);
  });
  it('rejects PDF and bad dates', () => {
    const s = makeServices(off);
    assert.throws(() => s.reports.dailyCsv(ADMIN, '2026-11-19', 'pdf'), (e) => e.message.includes('tez orada'));
    assert.throws(() => s.reports.dailyCsv(ADMIN, 'x'), ValidationError);
  });
  it('CB_RECEPTION_OPENS_DASHBOARD: receptionist gets the numbers on, Forbidden off', () => {
    const stats = makeServices(onlyDefects('CB_RECEPTION_OPENS_DASHBOARD')).dashboard.stats(RECEPTION);
    assert.equal(stats.appointmentsToday, 8);
    assert.equal(stats.doctors, 12);
    assert.equal(stats.patients, 8);
    assert.ok(stats.upcomingAppointments > 0);
    assert.throws(() => makeServices(off).dashboard.stats(RECEPTION), ForbiddenError);
    assert.throws(() => makeServices(off).dashboard.stats(DR_RAO), ForbiddenError);
    assert.equal(makeServices(off).dashboard.stats(ADMIN).doctors, 12);
  });
});
