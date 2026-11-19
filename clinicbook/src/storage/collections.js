import { FIRST_NEW_REFERENCE } from '../data/seed.js';

/** Placeholder password hash used by the seed command, which has no access to the training password. */
export const SHARED_HASH_SENTINEL = 'shared-training-password';

const DAY_NAMES = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

function scheduleSummary({ schedule }) {
  const days = DAY_NAMES.map((name, d) => {
    const day = schedule.days[d];
    return day?.off ? `${name} dam` : `${name} ${day?.start}-${day?.end}`;
  });
  return `${days.join('; ')} (${schedule.slotMinutes} daq)`;
}

/**
 * The six collections stored in Notion. Each one says how to name a row (key), describe it for
 * people (summary), and turn an entity into plain JSON and back. Secrets never reach Notion:
 * staff password hashes are dropped, and a patient hash equal to the shared training password is
 * stored as null and restored from the environment on load.
 */
export function createCollections({ isSharedHash }) {
  return [
    {
      name: 'doctors',
      title: 'CB Doctors',
      key: (d) => d.id,
      summary: (d) => `${d.name} | ${d.specialty} | ${d.years} yil`,
      serialize: (d) => d,
      deserialize: (o) => o,
    },
    {
      name: 'schedules',
      title: 'CB Schedules',
      key: (s) => s.doctorId,
      summary: scheduleSummary,
      serialize: (s) => s,
      deserialize: (o) => o,
    },
    {
      name: 'appointments',
      title: 'CB Appointments',
      key: (a) => a.reference,
      summary: (a) => `${a.reference} | ${a.date} ${a.time} | ${a.doctorId} | ${a.patientId} | ${a.status}`,
      serialize: (a) => a,
      deserialize: (o) => o,
    },
    {
      name: 'patients',
      title: 'CB Patients',
      key: (p) => p.id,
      summary: (p) => `${p.fullName} | ${p.email}`,
      serialize: (p) => ({ ...p, passwordHash: isSharedHash(p.passwordHash) ? null : p.passwordHash }),
      deserialize: (o, ctx) => ({ ...o, passwordHash: o.passwordHash ?? ctx.sharedHash }),
    },
    {
      name: 'staff',
      title: 'CB Staff',
      key: (s) => s.id,
      summary: (s) => `${s.name} | ${s.email} | ${s.role}`,
      serialize: ({ passwordHash: _dropped, ...rest }) => rest,
      deserialize: (o, ctx) => ({ ...o, passwordHash: ctx.sharedHash }),
    },
    {
      name: 'emails',
      title: 'CB Emails',
      key: (m) => `email-${m.n}`,
      summary: (m) => `${m.to} | ${m.subject}`,
      serialize: (m) => m,
      deserialize: (o) => o,
    },
  ];
}

/** Seed object (what createSeed returns) -> one list of entities per collection. */
export function snapshotFromSeed(seed) {
  return {
    doctors: seed.doctors,
    schedules: Object.entries(seed.schedules).map(([doctorId, schedule]) => ({ doctorId, schedule })),
    appointments: seed.appointments,
    patients: seed.patients,
    staff: seed.staff,
    emails: (seed.outbox ?? []).map((message, i) => ({ n: i + 1, ...message })),
  };
}

/** Inverse of snapshotFromSeed, used to start the app from rows loaded out of Notion. */
export function seedFromSnapshot(snapshot) {
  const emails = [...snapshot.emails].sort((a, b) => a.n - b.n);
  return {
    doctors: snapshot.doctors,
    schedules: Object.fromEntries(snapshot.schedules.map((s) => [s.doctorId, s.schedule])),
    patients: snapshot.patients,
    staff: snapshot.staff,
    appointments: snapshot.appointments,
    firstNewReference: FIRST_NEW_REFERENCE,
    outbox: emails.map(({ n: _n, ...message }) => message),
  };
}
