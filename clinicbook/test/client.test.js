import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { request } from '../public/js/api.js';
import { matchRoute } from '../public/js/router.js';
import { initialFilters, sortBy, toQuery as appointmentQuery } from '../public/js/state/appointmentFilters.js';
import { needsConfirmation } from '../public/js/state/cancel.js';
import { emptyFilters, resetFilters, toQuery as doctorQuery } from '../public/js/state/doctorFilters.js';
import { continueTime, isDayClickable, toggleSlot } from '../public/js/state/slotSelection.js';
import { alertBox, esc, fieldError, renderPatientHeader } from '../public/js/views/common.js';
import * as admin from '../public/js/views/admin.js';
import * as patient from '../public/js/views/patient.js';
import { DEFECT_IDS, createDefects, onlyDefects } from '../src/defects.js';
import { passwordRuleStates } from '../src/shared/rules.js';

const off = createDefects('off');

describe('router', () => {
  it('matches patient and back office routes with params', () => {
    assert.equal(matchRoute('/doctors').name, 'doctors');
    assert.deepEqual(matchRoute('/doctors/doctor-1?reschedule=CB-1').params, { id: 'doctor-1' });
    assert.equal(matchRoute('/book/confirm').name, 'booking');
    assert.equal(matchRoute('/admin/schedules/doctor-2').params.doctorId, 'doctor-2');
    assert.equal(matchRoute('/admin/patients/patient-1').resource, 'patients');
    assert.equal(matchRoute('/admin/appointments/').name, 'admin-appointments');
    assert.equal(matchRoute('/').name, 'home');
    assert.equal(matchRoute('/nothing'), null);
  });
});

describe('state: slot selection', () => {
  it('CB_TWO_SLOTS_SELECTABLE: selections add up on, replace off', () => {
    const on = onlyDefects('CB_TWO_SLOTS_SELECTABLE');
    assert.deepEqual(toggleSlot(toggleSlot([], '10:00', on), '11:30', on), ['10:00', '11:30']);
    assert.deepEqual(toggleSlot(['10:00', '11:30'], '10:00', on), ['11:30']);
    assert.deepEqual(toggleSlot(toggleSlot([], '10:00', off), '11:30', off), ['11:30']);
  });
  it('Continue uses the first chosen slot', () => {
    assert.equal(continueTime(['10:00', '11:30']), '10:00');
    assert.equal(continueTime([]), null);
  });
  it('CB_GREY_DAY_CLICKABLE: grey days click on, not off', () => {
    assert.equal(isDayClickable({ hasSlots: false }, onlyDefects('CB_GREY_DAY_CLICKABLE')), true);
    assert.equal(isDayClickable({ hasSlots: false }, off), false);
    assert.equal(isDayClickable({ hasSlots: true }, off), true);
  });
});

describe('state: filters and cancel', () => {
  it('CB_RESET_KEEPS_NAME: the name stays on, clears off; sort is kept', () => {
    const filters = { specialty: 'Kardiologiya', name: 'zzz', sort: 'experience' };
    assert.deepEqual(resetFilters(filters, onlyDefects('CB_RESET_KEEPS_NAME')), { specialty: '', name: 'zzz', sort: 'experience' });
    assert.deepEqual(resetFilters(filters, off), { specialty: '', name: '', sort: 'experience' });
    assert.deepEqual(emptyFilters(), { specialty: '', name: '', sort: 'next' });
    assert.equal(doctorQuery({ specialty: 'LOR', name: '', sort: 'next' }), 'specialty=LOR&sort=next');
  });
  it('CB_DEFAULT_RANGE_EMPTY: no dates on, today to today off', () => {
    assert.deepEqual([initialFilters('2026-11-19', onlyDefects('CB_DEFAULT_RANGE_EMPTY')).from, initialFilters('2026-11-19', onlyDefects('CB_DEFAULT_RANGE_EMPTY')).to], ['', '']);
    const ref = initialFilters('2026-11-19', off);
    assert.deepEqual([ref.from, ref.to], ['2026-11-19', '2026-11-19']);
    assert.equal(appointmentQuery(ref), 'from=2026-11-19&to=2026-11-19&sort=date&dir=asc&page=1');
  });
  it('column header clicks flip the direction', () => {
    const f = initialFilters('2026-11-19', off);
    assert.deepEqual([sortBy(f, 'date').dir, sortBy(sortBy(f, 'date'), 'date').dir, sortBy(f, 'doctor').dir], ['desc', 'asc', 'asc']);
  });
  it('CB_NO_CANCEL_CONFIRM: no dialog on, dialog off', () => {
    assert.equal(needsConfirmation(onlyDefects('CB_NO_CANCEL_CONFIRM')), false);
    assert.equal(needsConfirmation(off), true);
  });
});

describe('views: common', () => {
  it('escapes HTML and renders alerts and field errors', () => {
    assert.equal(esc('<b>"x"</b> & \'y\''), '&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; &#39;y&#39;');
    assert.equal(esc(null), '');
    assert.match(alertBox('Oops <b>'), /role="alert">Oops &lt;b&gt;/);
    assert.equal(alertBox(''), '');
    assert.match(fieldError({ email: 'Bad' }, 'email'), /data-error="email">Bad/);
    assert.equal(fieldError({}, 'email'), '');
  });
  it('shows login or the patient name in the header', () => {
    assert.match(renderPatientHeader({ patient: null, path: '/doctors' }), /Kirish/);
    assert.match(renderPatientHeader({ patient: { fullName: 'Amina' }, path: '/my-appointments' }), /Amina[\s\S]*Chiqish/);
  });
});

describe('views: patient portal', () => {
  const doctor = { id: 'doctor-1', name: 'Dr. A. Rao', specialty: 'Kardiologiya', years: 14, nextAvailableText: '19 Noy 2026', initials: 'AR' };
  it('renders doctor cards with all fields and the empty state with Reset filters', () => {
    const page = patient.renderDoctorsPage({ doctors: [doctor], specialties: ['Kardiologiya'], filters: { specialty: '', name: '', sort: 'next' } });
    for (const text of ['Dr. A. Rao', 'Kardiologiya', '14 yil tajriba', 'Eng yaqin vaqt: 19 Noy 2026', 'Barcha mutaxassisliklar', 'Tajriba (koʻpdan kamga)']) assert.ok(page.includes(text), text);
    const empty = patient.renderDoctorsPage({ doctors: [], specialties: [], filters: { specialty: '', name: 'zzz', sort: 'next' } });
    assert.match(empty, /Tanlangan filtrlar boʻyicha shifokor topilmadi/);
    assert.match(empty, /Filtrlarni tozalash/);
    assert.match(empty, /value="zzz"/);
  });
  it('renders the slot picker: grey days, labels, note and the Continue button state', () => {
    const week = [{ date: '2026-11-19', weekday: 'Pa', day: 19, hasSlots: true }, { date: '2026-11-22', weekday: 'Ya', day: 22, hasSlots: false }];
    const base = { doctor, week, date: '2026-11-22', times: ['09:30', '14:00'], selected: ['14:00'] };
    const ref = patient.renderDoctorPage({ ...base, defects: off });
    assert.match(ref, /Barcha vaqtlar klinikaning mahalliy vaqti boʻyicha \(UTC\+5\)/);
    assert.match(ref, /disabled>Ya 22/);
    assert.match(ref, /Ya 22 Noy 2026 kuni boʻsh vaqtlar/);
    assert.match(ref, />09:30</);
    assert.match(ref, /class="slot selected"[^>]*>14:00/);
    assert.ok(!/data-action="continue" disabled/.test(ref));
    const on = patient.renderDoctorPage({ ...base, defects: createDefects('on'), reschedule: 'CB-9' });
    assert.ok(!/disabled>Ya 22/.test(on));
    assert.match(on, />2:00 PM</);
    assert.match(on, /CB-9 raqamli qabul uchun yangi vaqtni tanlang/);
    assert.match(patient.renderDoctorPage({ ...base, date: null, selected: [], times: [], defects: off }), /data-action="continue" disabled/);
  });
  it('renders the registration form with live rules and errors', () => {
    const html = patient.renderRegisterForm({ values: { fullName: 'A' }, errors: { email: 'Toʻgʻri email kiriting' }, ruleStates: passwordRuleStates('Abc123'), done: true });
    for (const text of ['8 yoki undan ortiq belgi', '1 ta bosh harf', '1 ta raqam', 'Toʻgʻri email kiriting', 'Hisob yaratildi', 'Parolni tasdiqlang']) assert.ok(html.includes(text), text);
    assert.match(patient.renderRules(passwordRuleStates('Abc123')), /\[ \] 8 yoki undan ortiq belgi/);
    assert.match(patient.renderLoginForm({ message: 'Email yoki parol notoʻgʻri', email: 'a@b.co' }), /Email yoki parol notoʻgʻri/);
    for (const form of [patient.renderLoginForm({}), admin.renderAdminLogin({})]) {
      assert.match(form, /name="email"/, 'FormData needs named inputs');
      assert.match(form, /name="password"/);
    }
  });
  it('renders the booking summary and confirmation page', () => {
    const summary = patient.renderBookingSummary({ doctor, date: '2026-11-20', time: '10:30', reason: '', error: '' });
    for (const text of ['Dr. A. Rao, Kardiologiya', 'Ju 20 Noy 2026', '10:30 (klinikaning mahalliy vaqti, UTC+5)', 'Qabulni tasdiqlash']) assert.ok(summary.includes(text), text);
    assert.ok(!summary.includes('/200'), 'the character counter is not built yet');
    const confirmation = patient.renderConfirmation({ reference: 'CB-304517', doctorName: 'Dr. A. Rao', specialty: 'Kardiologiya', confirmationDateText: 'Ju 20 Noy 2026', time: '10:30' });
    assert.match(confirmation, /Qabul raqami: CB-304517/);
  });
  it('renders My appointments tabs with Reschedule and Cancel, and the cancel dialog', () => {
    const a = { reference: 'CB-1', dateLongText: 'Ju 20 Noy 2026', time: '10:30', doctorName: 'Dr. A. Rao', status: 'Booked' };
    const upcoming = patient.renderMyAppointments({ tab: 'upcoming', data: { upcoming: [a], past: [] }, error: '' });
    assert.match(upcoming, /Boshqa vaqtga koʻchirish/);
    assert.match(upcoming, /Bekor qilish/);
    assert.match(upcoming, /Oʻtgan va bekor qilingan/);
    const past = patient.renderMyAppointments({ tab: 'past', data: { upcoming: [], past: [{ ...a, status: 'Cancelled' }] }, error: 'x' });
    assert.match(past, /chip Cancelled/);
    assert.ok(!/data-action="cancel"/.test(past));
    assert.match(patient.renderMyAppointments({ tab: 'upcoming', data: { upcoming: [], past: [] } }), /Hozircha hech narsa yoʻq/);
    const dialog = patient.renderCancelDialog(a);
    for (const text of ['Bu qabulni bekor qilasizmi?', 'Qabulni saqlash', 'Ha, bekor qilish']) assert.ok(dialog.includes(text), text);
  });
});

describe('views: back office', () => {
  const user = { name: 'Qabulxona', role: 'Receptionist' };
  it('renders login, the shell with menu and the 403 page', () => {
    assert.match(admin.renderAdminLogin({ message: 'Seans muddati tugadi. Iltimos, qaytadan kiring.' }), /Seans muddati tugadi/);
    const shell = admin.renderAdminShell({ user, menu: [{ href: '/admin/appointments', label: 'Appointments' }], path: '/admin/appointments', content: '<p>x</p>' });
    assert.match(shell, /Qabulxona \(Qabulxona xodimi\)/);
    assert.match(shell, /class="active">Appointments/);
    const forbidden = admin.renderForbidden('/admin/appointments');
    assert.match(forbidden, /403/);
    assert.match(forbidden, /Bu sahifaga kirish huquqingiz yoʻq/);
    assert.match(forbidden, /Bosh sahifamga oʻtish/);
    assert.match(admin.renderDashboard({ appointmentsToday: 8, upcomingAppointments: 30, doctors: 12, patients: 8 }), /Bugungi qabullar/);
  });
  it('renders the appointments table with columns, counter and pager', () => {
    const result = { rows: [{ reference: 'CB-1', patient: 'Patient, Amina', patientId: 'patient-1', doctor: 'Dr. A. Rao', dateText: '19 Noy 2026', time: '12:00', status: 'Booked' }], page: 1, lastPage: 3, counter: '57 tadan 1-20 koʻrsatilmoqda' };
    const html = admin.renderAppointmentsPage({ filters: { from: '2026-11-19', to: '2026-11-19', doctorId: '', status: '', sort: 'date', dir: 'asc' }, doctors: [{ id: 'doctor-1', name: 'Dr. A. Rao' }], result });
    for (const text of ['Raqam', 'Bemor', 'Shifokor', 'Sana', 'Vaqt', 'Holat', '57 tadan 1-20 koʻrsatilmoqda', '/admin/patients/patient-1', 'Sahifa 1 / 3']) assert.ok(html.includes(text), text);
    assert.match(admin.renderAppointmentsPage({ filters: { sort: 'time', dir: 'desc' }, doctors: [], result: { ...result, rows: [], page: 3 } }), /Qabullar yoʻq/);
  });
  it('renders the weekly schedule grid, conflict warning and toast', () => {
    const schedule = { slotMinutes: 30, days: { 0: { off: true }, 1: { off: false, start: '09:00', end: '17:00' }, 2: { off: false, start: '09:00', end: '17:00' }, 3: { off: false, start: '09:00', end: '17:00' }, 4: { off: false, start: '09:00', end: '17:00' }, 5: { off: false, start: '09:00', end: '17:00' }, 6: { off: true } } };
    const data = { doctor: { id: 'doctor-1', name: 'Dr. A. Rao' }, doctors: [{ id: 'doctor-1', name: 'Dr. A. Rao' }], schedule, appointments: [{ reference: 'CB-1', patientName: 'P', dateText: '23 Noy 2026', time: '10:00' }] };
    const html = admin.renderSchedulePage({ data, errors: { Dushanba: 'Tugash vaqti boshlanish vaqtidan keyin boʻlishi kerak' }, conflicts: [{ reference: 'CB-1', patient: 'P', date: '2026-11-23', time: '10:00' }], notice: 'Jadval saqlandi' });
    for (const text of ['Dushanba', 'Dam olish kuni', 'Tugash vaqti boshlanish vaqtidan keyin boʻlishi kerak', 'Baribir saqlash', 'Jadval saqlandi', 'Jadvalni saqlash', 'doctor-picker', 'CB-1']) assert.ok(html.includes(text), text);
    assert.ok(!admin.renderSchedulePage({ data: { ...data, doctors: undefined, appointments: [] } }).includes('doctor-picker'));
  });
  it('renders the patient record, empty history and Show all visits', () => {
    const record = { fullName: 'Patient, Amina', dob: '14 Mar 1990', age: 36, phone: '+1 *** *** 1234', email: 'a@b.co', visits: [{ date: '12 Noy 2026', doctor: 'Dr. A. Rao', status: 'Completed' }], hasMore: true };
    const html = admin.renderPatientRecord(record);
    for (const text of ['Tugʻilgan sana: 14 Mar 1990 (yoshi: 36)', '+1 *** *** 1234', 'Tashriflar tarixi (yangilari birinchi)', 'Barcha tashriflarni koʻrsatish']) assert.ok(html.includes(text), text);
    assert.match(admin.renderPatientRecord({ ...record, visits: [], hasMore: false }), /Hali tashriflar yoʻq/);
  });
  it('renders the reports page: Export only when allowed, PDF disabled', () => {
    const admins = admin.renderReportsPage({ date: '2026-11-19', role: 'Admin', defects: off });
    assert.match(admins, /data-action="export"/);
    assert.match(admins, /PDF \(Tez orada\)/);
    assert.ok(!admin.renderReportsPage({ date: '2026-11-19', role: 'Receptionist', defects: off }).includes('data-action="export"'));
    assert.match(admin.renderReportsPage({ date: '2026-11-19', role: 'Receptionist', defects: onlyDefects('CB_RECEPTION_SEES_EXPORT') }), /data-action="export"/);
  });
});

describe('api client', () => {
  const reply = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });
  it('sends JSON and returns the parsed body', async () => {
    let seen;
    const data = await request('POST', '/x', { a: 1 }, async (url, init) => { seen = { url, init }; return reply(200, { ok: true })(); });
    assert.deepEqual(data, { ok: true });
    assert.equal(seen.init.method, 'POST');
    assert.equal(seen.init.body, '{"a":1}');
    await request('GET', '/x', undefined, async (url, init) => { assert.equal(init.body, undefined); return reply(200, {})(); });
  });
  it('throws errors that carry status and body, with a fallback message', async () => {
    await assert.rejects(request('GET', '/x', undefined, reply(409, { error: 'Taken', details: { a: 1 } })), (e) => e.message === 'Taken' && e.status === 409 && e.data.details.a === 1);
    await assert.rejects(request('GET', '/x', undefined, async () => ({ ok: false, status: 500, json: async () => { throw new Error('no json'); } })), /Soʻrov bajarilmadi/);
  });
});

describe('browser files', () => {
  const files = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
  it('every browser script parses (DOM glue is exercised by the smoke run, not unit tests)', () => {
    for (const file of files('public/js').filter((f) => f.endsWith('.js'))) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      assert.equal(result.status, 0, `${file}: ${result.stderr}`);
    }
  });
});

describe('defect coverage', () => {
  it('every seeded defect id is exercised by a test', () => {
    const tests = files_('test').map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const id of DEFECT_IDS) assert.ok(new RegExp(`\\b${id}\\b`).test(tests), `no test mentions ${id}`);
  });
});

function files_(dir) {
  return readdirSync(dir).filter((n) => n.endsWith('.test.js')).map((n) => join(dir, n));
}
