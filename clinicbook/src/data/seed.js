import { addDays, weekday } from '../shared/time.js';
import { fitsWindow } from '../domain/slots.js';

export const SEED_TODAY = '2026-11-19';
export const FIRST_NEW_REFERENCE = 304517;

export const SPECIALTIES = Object.freeze([
  'Kardiologiya',
  'Dermatologiya',
  'Pediatriya',
  'Nevrologiya',
  'Ortopediya',
  'Ginekologiya',
  'LOR',
  'Umumiy amaliyot',
]);

// Experience in years: 2,3,6,6,9,9,11,12,14,15,18,22 as the Notion test data says.
const DOCTORS = [
  ['doctor-1', 'Dr. A. Rao', 'Kardiologiya', 14],
  ['doctor-2', 'Dr. L. Kim', 'Dermatologiya', 6],
  ['doctor-3', 'Dr. S. Roy', 'Pediatriya', 9],
  ['doctor-4', 'Dr. M. Okafor', 'Nevrologiya', 18],
  ['doctor-5', 'Dr. P. Novak', 'Ortopediya', 22],
  ['doctor-6', 'Dr. H. Tanaka', 'Ginekologiya', 11],
  ['doctor-7', 'Dr. E. Silva', 'LOR', 2],
  ['doctor-8', 'Dr. J. Brown', 'Umumiy amaliyot', 15],
  ['doctor-9', 'Dr. N. Haddad', 'Kardiologiya', 3],
  ['doctor-10', 'Dr. T. Lindqvist', 'Nevrologiya', 6],
  ['doctor-11', 'Dr. R. Mehta', 'Pediatriya', 9],
  ['doctor-12', 'Dr. C. Duarte', 'Umumiy amaliyot', 12],
];

// Amina's name is stored as "Last, First" (legacy import): the only patient name with a comma.
const PATIENTS = [
  ['patient-1', 'Patient, Amina', '1990-03-14', '+1 555 010 1234', 'amina.patient@example.com'],
  ['patient-2', 'Bilal Hassan', '1985-07-02', '+1 555 010 2222', 'bilal.hassan@example.com'],
  ['patient-3', 'Carlos Vega', '1978-01-23', '+1 555 010 3333', 'carlos.vega@example.com'],
  ['patient-4', 'Dana Lee', '1992-09-09', '+1 555 010 4444', 'dana.lee@example.com'],
  ['patient-5', 'Evan Wright', '1969-12-30', '+1 555 010 5555', 'evan.wright@example.com'],
  ['patient-6', 'Fatima Noor', '2001-05-17', '+1 555 010 6666', 'fatima.noor@example.com'],
  ['patient-7', 'Grace Hall', '1983-04-04', '+1 555 010 7777', 'grace.hall@example.com'],
  ['patient-8', 'Hugo Martin', '1996-11-11', '+1 555 010 8888', 'hugo.martin@example.com'],
];

const STAFF = [
  ['staff-1', 'admin@clinicbook.test', 'Klinika administratori', 'Admin', null],
  ['staff-2', 'reception@clinicbook.test', 'Qabulxona', 'Receptionist', null],
  ['staff-3', 'doctor.rao@clinicbook.test', 'Dr. A. Rao', 'Doctor', 'doctor-1'],
];

function weekSchedule(startDay, endDay, start, end, slotMinutes = 30) {
  const days = {};
  for (let d = 0; d < 7; d += 1) {
    days[d] = d >= startDay && d <= endDay ? { off: false, start, end } : { off: true };
  }
  return { slotMinutes, days };
}

function schedules() {
  const result = {};
  for (const [id] of DOCTORS) result[id] = weekSchedule(1, 5, '09:00', '17:00'); // Mon-Fri 09:00-17:00
  result['doctor-2'] = weekSchedule(1, 5, '10:00', '18:00');
  result['doctor-3'] = weekSchedule(2, 6, '09:00', '15:00'); // Tue-Sat
  return result;
}

const AMINA_VISITS = [
  ['2026-11-10', 'doctor-2', '10:00', 'Completed'],
  ['2026-11-10', 'doctor-5', '11:00', 'Completed'],
  ['2026-11-11', 'doctor-1', '09:30', 'Completed'],
  ['2026-11-11', 'doctor-4', '13:00', 'Completed'],
  ['2026-11-12', 'doctor-1', '14:00', 'Completed'],
  ['2026-11-12', 'doctor-2', '15:00', 'Completed'],
  ['2026-11-13', 'doctor-6', '10:30', 'No-show'],
  ['2026-11-13', 'doctor-8', '13:30', 'Completed'],
  ['2026-11-16', 'doctor-9', '11:00', 'Completed'],
  ['2026-11-17', 'doctor-1', '11:00', 'Completed'],
  ['2026-11-17', 'doctor-7', '14:00', 'Completed'],
  ['2026-11-18', 'doctor-2', '10:30', 'Completed'],
];

const SLOT_POOL = ['10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30'];
const PAST_STATUSES = ['Completed', 'Completed', 'No-show', 'Cancelled'];

function weekdaysBetween(from, to) {
  const result = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (weekday(d) >= 1 && weekday(d) <= 5) result.push(d);
  return result;
}

/** 57 appointments from 10 Nov to 05 Dec 2026. Counts per day are fixed by the walkthroughs. */
function buildAppointments(scheduleMap) {
  const list = [];
  const taken = new Set();
  const add = (reference, patientId, doctorId, date, time, status) => {
    taken.add(`${doctorId}|${date}|${time}`);
    list.push({ reference, patientId, doctorId, date, time, status });
  };

  AMINA_VISITS.forEach(([date, doctorId, time, status], i) => add(`CB-3044${String(i + 1).padStart(2, '0')}`, 'patient-1', doctorId, date, time, status));
  add('CB-304498', 'patient-3', 'doctor-1', '2026-11-19', '10:30', 'Booked'); // the booked 10:30 slot of Dr. Rao today
  add('CB-304511', 'patient-1', 'doctor-1', '2026-11-23', '10:00', 'Booked'); // Monday appointment of the schedule walkthrough
  add('CB-304530', 'patient-1', 'doctor-2', '2026-11-19', '12:00', 'Booked'); // today 12:00 (cancel walkthrough)

  const perDay = new Map([['2026-11-19', 6], ['2026-11-20', 3]]);
  const otherDays = weekdaysBetween('2026-11-10', '2026-12-04').filter((d) => !perDay.has(d));
  otherDays.forEach((d, i) => perDay.set(d, i < 15 ? 2 : 1)); // 15*2 + 2*1 = 32
  perDay.set('2026-12-05', 1);

  const patientsPool = ['patient-3', 'patient-4', 'patient-5', 'patient-6', 'patient-7', 'patient-8'];
  const sequence = [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  let counter = 0;
  for (const [date, count] of sequence) {
    for (let k = 0; k < count; k += 1) {
      // Dr. Rao only has the named appointments after today, so the walkthroughs stay predictable.
      for (let guard = 0; guard < 200; guard += 1) {
        counter += 1;
        const doctorIndex = date === '2026-12-05' ? 2 : (counter * 5) % 12;
        const [doctorId] = DOCTORS[doctorIndex];
        const time = date === '2026-12-05' ? '10:00' : SLOT_POOL[(counter * 3 + k) % SLOT_POOL.length];
        if (doctorId === 'doctor-1') continue;
        const day = scheduleMap[doctorId].days[weekday(date)];
        if (!fitsWindow(time, 30, day) || taken.has(`${doctorId}|${date}|${time}`)) continue;
        const status = date < SEED_TODAY ? PAST_STATUSES[counter % PAST_STATUSES.length] : 'Booked';
        add(`CB-304${String(100 + list.length)}`, patientsPool[counter % patientsPool.length], doctorId, date, time, status);
        break;
      }
    }
  }
  return list;
}

/** Fresh seed data. `passwordHash` is the hash of the shared training password. */
export function createSeed({ passwordHash }) {
  const scheduleMap = schedules();
  return {
    doctors: DOCTORS.map(([id, name, specialty, years]) => ({ id, name, specialty, years })),
    schedules: scheduleMap,
    patients: PATIENTS.map(([id, fullName, dob, phone, email]) => ({ id, fullName, dob, phone, email, passwordHash })),
    staff: STAFF.map(([id, email, name, role, doctorId]) => ({ id, email, name, role, doctorId, passwordHash })),
    appointments: buildAppointments(scheduleMap),
    firstNewReference: FIRST_NEW_REFERENCE,
  };
}
