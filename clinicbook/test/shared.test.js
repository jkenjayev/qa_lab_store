import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAccess, menuFor, startPage } from '../src/shared/access.js';
import { createDefects, onlyDefects } from '../src/defects.js';
import { PASSWORD_RULES, completedYears, passwordMeetsRules, passwordRuleStates, validateRegistration } from '../src/shared/rules.js';
import { slotLabel } from '../src/shared/slotLabel.js';
import * as t from '../src/shared/time.js';

const off = createDefects('off');
const valid = { fullName: 'Test Person', email: 'a@b.co', phone: '+1 555 010 9999', dob: '1990-01-01', password: 'Abcdef12', confirmPassword: 'Abcdef12' };
const ctx = (defects = off, taken = () => false) => ({ today: '2026-11-19', emailTaken: taken, defects });

describe('time helpers', () => {
  it('formats dates like the designs', () => {
    assert.equal(t.formatDate('2026-12-05'), '05 Dek 2026');
    assert.equal(t.formatDateLong('2026-11-20'), 'Ju 20 Noy 2026');
    assert.equal(t.weekday('2026-11-19'), 4);
    assert.equal(t.weekdayShort('2026-11-22'), 'Ya');
  });
  it('does date arithmetic', () => {
    assert.equal(t.addDays('2026-11-30', 1), '2026-12-01');
    assert.equal(t.addDays('2026-11-20', -1), '2026-11-19');
    assert.equal(t.toDateStr(new Date(Date.UTC(2026, 0, 5))), '2026-01-05');
    assert.equal(t.toTimeStr(new Date(Date.UTC(2026, 0, 5, 9, 5))), '09:05');
  });
  it('validates dates and times', () => {
    assert.equal(t.isValidDate('2026-02-30'), false);
    assert.equal(t.isValidDate('2026-11-19'), true);
    assert.equal(t.isValidDate(5), false);
    assert.equal(t.isValidTime('24:00'), false);
    assert.equal(t.isValidTime('09:30'), true);
  });
  it('converts times', () => {
    assert.equal(t.timeToMinutes('09:30'), 570);
    assert.equal(t.minutesToTime(570), '09:30');
    assert.equal(t.format12h('00:15'), '12:15 AM');
    assert.equal(t.format12h('09:00'), '9:00 AM');
    assert.equal(t.format12h('12:00'), '12:00 PM');
    assert.equal(t.format12h('16:30'), '4:30 PM');
    assert.equal(t.instantMinutes('1970-01-02', '01:00'), 24 * 60 + 60);
  });
});

describe('rules', () => {
  it('computes completed years', () => {
    assert.equal(completedYears('1990-03-14', '2026-11-19'), 36);
    assert.equal(completedYears('1990-11-19', '2026-11-19'), 36);
    assert.equal(completedYears('1990-11-20', '2026-11-19'), 35);
  });
  it('shows three password rules with ticks', () => {
    assert.equal(PASSWORD_RULES.length, 3);
    assert.deepEqual(passwordRuleStates('Abc123').map((r) => r.ok), [false, true, true]);
    assert.deepEqual(passwordRuleStates('Abcdef12').map((r) => r.ok), [true, true, true]);
  });
  it('accepts a valid registration', () => {
    assert.deepEqual(validateRegistration(valid, ctx()), {});
  });
  it('reports every field error with the designed text', () => {
    const errors = validateRegistration({ fullName: '', email: 'nope', phone: '12', dob: '', password: 'x', confirmPassword: 'y' }, ctx());
    assert.equal(errors.fullName, 'Toʻliq ismingizni kiriting');
    assert.equal(errors.email, 'Toʻgʻri email kiriting');
    assert.equal(errors.phone, 'Toʻgʻri telefon raqamini kiriting');
    assert.equal(errors.dob, 'Tugʻilgan sanangizni kiriting');
    assert.equal(errors.password, 'Parol qoidalarga mos kelmaydi');
    assert.equal(errors.confirmPassword, 'Parollar mos kelmadi');
  });
  it('refuses a taken email and under-18 patients', () => {
    assert.equal(validateRegistration(valid, ctx(off, () => true)).email, 'Bu email allaqachon roʻyxatdan oʻtgan');
    assert.equal(validateRegistration({ ...valid, dob: '2012-05-05' }, ctx()).dob, '18 yoshga toʻlmagan bemorni ota-onasi yoki qonuniy vakili roʻyxatdan oʻtkazishi kerak');
  });
  it('CB_PASSWORD_MIN_6: Abc123 is accepted on, refused off', () => {
    assert.equal(passwordMeetsRules('Abc123', onlyDefects('CB_PASSWORD_MIN_6')), true);
    assert.equal(passwordMeetsRules('Abc123', off), false);
    assert.equal(passwordMeetsRules('abcdefg1', off), false);
    assert.equal(passwordMeetsRules('Abcdefgh', off), false);
  });
  it('CB_FUTURE_DOB_ACCEPTED: a future date of birth passes on, fails off', () => {
    const input = { ...valid, dob: '2030-01-01' };
    assert.equal(validateRegistration(input, ctx(onlyDefects('CB_FUTURE_DOB_ACCEPTED'))).dob, undefined);
    assert.equal(validateRegistration(input, ctx(off)).dob, 'Tugʻilgan sana kelajakda boʻlishi mumkin emas');
  });
});

describe('access matrix', () => {
  it('start pages follow the role', () => {
    assert.equal(startPage('Admin'), '/admin/dashboard');
    assert.equal(startPage('Receptionist'), '/admin/appointments');
    assert.equal(startPage('Doctor'), '/admin/my-schedule');
    assert.equal(startPage('Nobody'), '/admin/login');
  });
  it('matches the role table of the design', () => {
    assert.equal(canAccess('Admin', 'dashboard', off), true);
    assert.equal(canAccess('Receptionist', 'dashboard', off), false);
    assert.equal(canAccess('Doctor', 'dashboard', off), false);
    assert.equal(canAccess('Doctor', 'my-schedule', off), true);
    assert.equal(canAccess('Receptionist', 'my-schedule', off), false);
    assert.equal(canAccess('Receptionist', 'schedules', off), false);
    assert.equal(canAccess('Doctor', 'schedules', off), true);
    assert.equal(canAccess('Receptionist', 'patients', off), true);
    assert.equal(canAccess('Doctor', 'reports', off), false);
    assert.equal(canAccess('Admin', 'reports', off), true);
    assert.equal(canAccess('Admin', 'unknown', off), false);
  });
  it('CB_RECEPTION_OPENS_DASHBOARD: receptionist opens the dashboard on, not off', () => {
    assert.equal(canAccess('Receptionist', 'dashboard', onlyDefects('CB_RECEPTION_OPENS_DASHBOARD')), true);
    assert.equal(canAccess('Receptionist', 'dashboard', off), false);
  });
  it('CB_RECEPTION_SEES_EXPORT: receptionist gets Reports on, not off', () => {
    assert.equal(canAccess('Receptionist', 'reports', onlyDefects('CB_RECEPTION_SEES_EXPORT')), true);
    assert.equal(canAccess('Receptionist', 'reports', off), false);
  });
  it('menus hide what a role cannot open (the dashboard defect works only by URL)', () => {
    assert.deepEqual(menuFor('Admin', off).map((m) => m.label), ['Boshqaruv paneli', 'Qabullar', 'Jadvallar', 'Hisobotlar']);
    assert.deepEqual(menuFor('Receptionist', off).map((m) => m.label), ['Qabullar']);
    assert.deepEqual(menuFor('Doctor', off).map((m) => m.label), ['Qabullar', 'Mening jadvalim']);
    assert.deepEqual(menuFor('Receptionist', createDefects('on')).map((m) => m.label), ['Qabullar', 'Hisobotlar']);
  });
});

describe('slot labels', () => {
  it('CB_SLOTS_12H: AM/PM on, 24-hour off', () => {
    assert.equal(slotLabel('14:00', onlyDefects('CB_SLOTS_12H')), '2:00 PM');
    assert.equal(slotLabel('09:30', onlyDefects('CB_SLOTS_12H')), '9:30 AM');
    assert.equal(slotLabel('14:00', off), '14:00');
  });
});
