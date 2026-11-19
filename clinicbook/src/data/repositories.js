import { NOOP_SINK } from '../storage/sink.js';

/**
 * In-memory repositories. Each class is small and has one job, so services depend on narrow contracts.
 * Writes are also announced to a sink (sink.upsert(collection, entity)); the sink persists them to Notion,
 * or does nothing in memory mode.
 */
export class DoctorRepository {
  constructor(doctors) {
    this.doctors = doctors;
  }
  list() {
    return this.doctors;
  }
  get(id) {
    return this.doctors.find((d) => d.id === id) ?? null;
  }
}

export class ScheduleRepository {
  constructor(schedules, sink = NOOP_SINK) {
    this.schedules = schedules;
    this.sink = sink;
  }
  get(doctorId) {
    return this.schedules[doctorId] ?? null;
  }
  set(doctorId, schedule) {
    this.schedules[doctorId] = schedule;
    this.sink.upsert('schedules', { doctorId, schedule });
  }
}

/** Next free booking number: references of new bookings are first, first+3, first+6 ... */
export function nextReferenceNumber(appointments, first) {
  let next = first;
  for (const a of appointments) {
    const n = Number(String(a.reference).replace(/\D/g, ''));
    if (n >= first && (n - first) % 3 === 0 && n + 3 > next) next = n + 3;
  }
  return next;
}

export class AppointmentRepository {
  constructor(appointments, firstReference, sink = NOOP_SINK) {
    this.appointments = appointments;
    this.nextNumber = nextReferenceNumber(appointments, firstReference);
    this.sink = sink;
  }
  list() {
    return this.appointments;
  }
  get(reference) {
    return this.appointments.find((a) => a.reference === reference) ?? null;
  }
  add(appointment) {
    this.appointments.push(appointment);
    this.sink.upsert('appointments', appointment);
    return appointment;
  }
  /** Services change appointments in place (status, date, time); call this afterwards to persist the change. */
  save(appointment) {
    this.sink.upsert('appointments', appointment);
    return appointment;
  }
  /** References of new bookings: CB-304517, CB-304520, ... (step 3) so they never collide with seed data. */
  nextReference() {
    const reference = `CB-${this.nextNumber}`;
    this.nextNumber += 3;
    return reference;
  }
}

export class PatientRepository {
  constructor(patients, sink = NOOP_SINK) {
    this.patients = patients;
    this.sink = sink;
  }
  list() {
    return this.patients;
  }
  get(id) {
    return this.patients.find((p) => p.id === id) ?? null;
  }
  findByEmailExact(email) {
    return this.patients.find((p) => p.email === email) ?? null;
  }
  findByEmailIgnoreCase(email) {
    return this.patients.find((p) => p.email.toLowerCase() === email.toLowerCase()) ?? null;
  }
  add(patient) {
    const created = { ...patient, id: `patient-${this.patients.length + 1}` };
    this.patients.push(created);
    this.sink.upsert('patients', created);
    return created;
  }
}

export class StaffRepository {
  constructor(staff) {
    this.staff = staff;
  }
  get(id) {
    return this.staff.find((s) => s.id === id) ?? null;
  }
  findByEmail(email) {
    return this.staff.find((s) => s.email === String(email).trim().toLowerCase()) ?? null;
  }
}

export class SessionRepository {
  constructor(generateToken) {
    this.generateToken = generateToken;
    this.sessions = new Map();
  }
  create(data, nowMinutes) {
    const token = this.generateToken();
    this.sessions.set(token, { ...data, lastActivity: nowMinutes });
    return token;
  }
  get(token) {
    return token ? (this.sessions.get(token) ?? null) : null;
  }
  touch(token, nowMinutes) {
    const session = this.sessions.get(token);
    if (session) session.lastActivity = nowMinutes;
  }
  remove(token) {
    this.sessions.delete(token);
  }
}

export class LoginAttemptRepository {
  constructor() {
    this.attempts = new Map();
  }
  get(key) {
    if (!this.attempts.has(key)) this.attempts.set(key, { count: 0, lockedUntil: 0 });
    return this.attempts.get(key);
  }
  reset(key) {
    this.attempts.delete(key);
  }
}

export class OutboxRepository {
  constructor(messages = [], sink = NOOP_SINK) {
    this.messages = [...messages];
    this.sink = sink;
  }
  add(message) {
    this.messages.push(message);
    this.sink.upsert('emails', { n: this.messages.length, ...message });
    return message;
  }
  list() {
    return [...this.messages].reverse();
  }
}

export function createRepositories(seed, generateToken, sink = NOOP_SINK) {
  return {
    doctors: new DoctorRepository(seed.doctors),
    schedules: new ScheduleRepository(seed.schedules, sink),
    appointments: new AppointmentRepository(seed.appointments, seed.firstNewReference, sink),
    patients: new PatientRepository(seed.patients, sink),
    staff: new StaffRepository(seed.staff),
    patientSessions: new SessionRepository(generateToken),
    staffSessions: new SessionRepository(generateToken),
    attempts: new LoginAttemptRepository(),
    outbox: new OutboxRepository(seed.outbox ?? [], sink),
  };
}
