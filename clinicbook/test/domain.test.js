import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ageFor } from '../src/domain/age.js';
import { queryAppointments } from '../src/domain/appointmentQuery.js';
import { buildDailyCsv, quoteCsv, reportFileName } from '../src/domain/csv.js';
import { filterAndSortDoctors } from '../src/domain/doctorQuery.js';
import { maskPhone } from '../src/domain/phone.js';
import { fitsWindow, generateTimes } from '../src/domain/slots.js';
import { toHttpError } from '../src/routes/http.js';
import * as errors from '../src/domain/errors.js';
import { createDefects, onlyDefects } from '../src/defects.js';

const off = createDefects('off');

describe('slot generation', () => {
  it('creates 30-minute slots that end inside the window', () => {
    const times = generateTimes({ start: '09:00', end: '11:00' }, 30);
    assert.deepEqual(times, ['09:00', '09:30', '10:00', '10:30']);
    assert.deepEqual(generateTimes({ start: '09:00', end: '10:30' }, 45), ['09:00', '09:45']);
    assert.equal(generateTimes({ start: '09:00', end: '17:00' }, 30).length, 16);
  });
  it('fitsWindow needs the whole slot inside working hours', () => {
    const day = { off: false, start: '09:00', end: '09:30' };
    assert.equal(fitsWindow('09:00', 30, day), true);
    assert.equal(fitsWindow('10:00', 30, day), false);
    assert.equal(fitsWindow('09:15', 30, day), false);
    assert.equal(fitsWindow('09:00', 30, { off: true }), false);
    assert.equal(fitsWindow('09:00', 30, undefined), false);
  });
});

describe('age', () => {
  it('CB_AGE_ROUNDED_UP: 37 on, 36 off for 14 Mar 1990 on 19 Noy 2026', () => {
    assert.equal(ageFor('1990-03-14', '2026-11-19', onlyDefects('CB_AGE_ROUNDED_UP')), 37);
    assert.equal(ageFor('1990-03-14', '2026-11-19', off), 36);
  });
  it('on a birthday both agree', () => {
    assert.equal(ageFor('1990-11-19', '2026-11-19', onlyDefects('CB_AGE_ROUNDED_UP')), 36);
  });
});

describe('phone masking', () => {
  it('keeps the last four digits', () => {
    assert.equal(maskPhone('+1 555 010 1234'), '+1 *** *** 1234');
  });
});

describe('csv', () => {
  it('CB_CSV_COMMAS_UNQUOTED: quotes on off, leaves raw on', () => {
    assert.equal(quoteCsv('Patient, Amina', off), '"Patient, Amina"');
    assert.equal(quoteCsv('Patient, Amina', onlyDefects('CB_CSV_COMMAS_UNQUOTED')), 'Patient, Amina');
    assert.equal(quoteCsv('He said "hi"', off), '"He said ""hi"""');
    assert.equal(quoteCsv('plain', off), 'plain');
  });
  it('CB_CSV_NAME_DD_MM_YYYY: file name', () => {
    assert.equal(reportFileName('2026-11-19', 'csv', off), 'appointments-2026-11-19.csv');
    assert.equal(reportFileName('2026-11-19', 'csv', onlyDefects('CB_CSV_NAME_DD_MM_YYYY')), 'appointments-19-11-2026.csv');
  });
  it('builds the file with header, columns and rows, or Qabullar yoʻq', () => {
    const rows = [{ time: '09:00', patient: 'Patient, Amina', doctor: 'Dr. A. Rao', status: 'Booked' }];
    assert.equal(buildDailyCsv({ date: '2026-11-19', rows, defects: off }), 'ClinicBook - Kunlik qabullar - 19 Noy 2026\nVaqt,Bemor,Shifokor,Holat\n09:00,"Patient, Amina",Dr. A. Rao,Band qilingan\n');
    assert.match(buildDailyCsv({ date: '2026-11-21', rows: [], defects: off }), /\nQabullar yoʻq\n$/);
  });
});

describe('doctor query', () => {
  const doctors = [
    { name: 'Dr. A. Rao', specialty: 'Kardiologiya', years: 14, nextAvailable: '2026-11-20' },
    { name: 'Dr. L. Kim', specialty: 'Dermatologiya', years: 6, nextAvailable: '2026-11-19' },
    { name: 'Dr. S. Roy', specialty: 'Pediatriya', years: 22, nextAvailable: '2026-11-19' },
  ];
  it('filters by specialty and sorts by next available then name by default', () => {
    assert.deepEqual(filterAndSortDoctors(doctors, { specialty: 'Kardiologiya' }, off).map((d) => d.name), ['Dr. A. Rao']);
    assert.deepEqual(filterAndSortDoctors(doctors, {}, off).map((d) => d.name), ['Dr. L. Kim', 'Dr. S. Roy', 'Dr. A. Rao']);
  });
  it('CB_DOCTOR_SEARCH_CASE_SENSITIVE: rao finds nothing on, finds Dr. Rao off', () => {
    assert.equal(filterAndSortDoctors(doctors, { name: 'rao' }, onlyDefects('CB_DOCTOR_SEARCH_CASE_SENSITIVE')).length, 0);
    assert.equal(filterAndSortDoctors(doctors, { name: 'Rao' }, onlyDefects('CB_DOCTOR_SEARCH_CASE_SENSITIVE')).length, 1);
    assert.equal(filterAndSortDoctors(doctors, { name: 'rao' }, off).length, 1);
  });
  it('CB_EXPERIENCE_SORT_ASCENDING: low to high on, high to low off', () => {
    assert.deepEqual(filterAndSortDoctors(doctors, { sort: 'experience' }, onlyDefects('CB_EXPERIENCE_SORT_ASCENDING')).map((d) => d.years), [6, 14, 22]);
    assert.deepEqual(filterAndSortDoctors(doctors, { sort: 'experience' }, off).map((d) => d.years), [22, 14, 6]);
  });
});

describe('appointment query', () => {
  const rows = ['2026-11-12', '2026-12-05', '2026-11-19', '2026-11-20', '2026-11-02'].map((date, i) => ({
    reference: `CB-${i}`, patient: `P${i}`, patientId: `p${i}`, doctor: i % 2 ? 'Dr. B' : 'Dr. A', doctorId: i % 2 ? 'd2' : 'd1', date, time: '10:00', status: i === 0 ? 'Cancelled' : 'Booked',
  }));
  const many = Array.from({ length: 57 }, (_, i) => ({ ...rows[0], reference: `CB-${i}`, date: '2026-11-10', time: `${String(8 + (i % 10)).padStart(2, '0')}:00` }));

  it('filters by doctor and status and sorts by other columns', () => {
    assert.equal(queryAppointments(rows, { doctorId: 'd2' }, off).total, 2);
    assert.equal(queryAppointments(rows, { status: 'Cancelled' }, off).total, 1);
    assert.deepEqual(queryAppointments(rows, { sort: 'reference', dir: 'desc' }, off).rows.map((r) => r.reference), ['CB-4', 'CB-3', 'CB-2', 'CB-1', 'CB-0']);
    assert.equal(queryAppointments(rows, { sort: 'time' }, off).rows.length, 5);
    assert.equal(queryAppointments(rows, { sort: 'nonsense' }, off).rows[0].date, '2026-11-02');
  });
  it('CB_RANGE_END_EXCLUSIVE: the end date is left out on, included off', () => {
    const range = { from: '2026-11-19', to: '2026-11-20' };
    assert.equal(queryAppointments(rows, range, onlyDefects('CB_RANGE_END_EXCLUSIVE')).total, 1);
    assert.equal(queryAppointments(rows, range, off).total, 2);
  });
  it('CB_DATE_SORT_AS_TEXT: 05 Dek before 12 Noy on, chronological off', () => {
    const texty = queryAppointments(rows, { sort: 'date' }, onlyDefects('CB_DATE_SORT_AS_TEXT')).rows.map((r) => r.date);
    assert.ok(texty.indexOf('2026-12-05') < texty.indexOf('2026-11-12'));
    const chronological = queryAppointments(rows, { sort: 'date' }, off).rows.map((r) => r.date);
    assert.deepEqual(chronological, [...chronological].sort());
    assert.equal(queryAppointments(rows, { sort: 'date' }, off).rows[0].dateText, '02 Noy 2026');
  });
  it('CB_COUNTER_PAGE_SIZE: of 20 on, of 57 off, 20 rows per page', () => {
    assert.equal(queryAppointments(many, {}, off).counter, '57 tadan 1-20 koʻrsatilmoqda');
    assert.equal(queryAppointments(many, {}, onlyDefects('CB_COUNTER_PAGE_SIZE')).counter, '20 tadan 1-20 koʻrsatilmoqda');
    assert.equal(queryAppointments(many, { page: 2 }, onlyDefects('CB_COUNTER_PAGE_SIZE')).counter, '20 tadan 21-40 koʻrsatilmoqda');
    assert.equal(queryAppointments(many, { page: 3 }, off).counter, '57 tadan 41-57 koʻrsatilmoqda');
    assert.equal(queryAppointments(many, { page: 99 }, off).page, 3);
    assert.equal(queryAppointments(many, {}, off).rows.length, 20);
  });
  it('an empty result says 0 tadan 0-0 koʻrsatilmoqda', () => {
    const result = queryAppointments(rows, { status: 'No-show' }, onlyDefects('CB_COUNTER_PAGE_SIZE'));
    assert.equal(result.counter, '0 tadan 0-0 koʻrsatilmoqda');
    assert.equal(result.lastPage, 1);
  });
});

describe('error mapping', () => {
  it('maps each domain error to its HTTP status', () => {
    assert.equal(toHttpError(new errors.ValidationError('x', { a: 'b' })).status, 400);
    assert.equal(toHttpError(new errors.UnauthorizedError('x', { expired: true })).body.expired, true);
    assert.equal(toHttpError(new errors.ForbiddenError('x')).status, 403);
    assert.equal(toHttpError(new errors.NotFoundError('x')).status, 404);
    assert.equal(toHttpError(new errors.ConflictError('x', { c: 1 })).body.details.c, 1);
    assert.equal(toHttpError(new errors.LockedError('x')).status, 429);
    assert.equal(toHttpError({ type: 'entity.parse.failed' }).status, 400);
    assert.equal(toHttpError(new Error('boom')).status, 500);
  });
});
