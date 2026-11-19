import { ageFor } from '../domain/age.js';
import { ForbiddenError, NotFoundError } from '../domain/errors.js';
import { maskPhone } from '../domain/phone.js';
import { MSG } from '../shared/messages.js';
import { formatDate, toDateStr } from '../shared/time.js';

const VISIT_STATUSES = new Set(['Completed', 'No-show']);
const VISIT_LIMIT = 10;

/** Patient record for staff. */
export class PatientRecordService {
  constructor({ doctors, patients, appointments, clock, defects }) {
    Object.assign(this, { doctors, patients, appointments, clock, defects });
  }

  get(actor, patientId, { all = false } = {}) {
    const patient = this.patients.get(patientId);
    if (!patient) throw new NotFoundError(`Bemor ${patientId} topilmadi`);

    if (actor.role === 'Doctor') {
      const isTheirPatient = this.appointments.list().some((a) => a.patientId === patientId && a.doctorId === actor.doctorId);
      // CB_DOCTOR_OPENS_ANY_PATIENT (Doctor can open any patient record by id)
      if (!isTheirPatient && !this.defects.CB_DOCTOR_OPENS_ANY_PATIENT) throw new ForbiddenError(MSG.FORBIDDEN);
    }

    const visits = this.appointments
      .list()
      .filter((a) => a.patientId === patientId && VISIT_STATUSES.has(a.status))
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
    // CB_HISTORY_OLDEST_FIRST (Visit history is oldest first)
    if (this.defects.CB_HISTORY_OLDEST_FIRST) visits.reverse();
    const shown = all ? visits : visits.slice(0, VISIT_LIMIT);

    // CB_PHONE_NOT_MASKED (Phone is not masked for the Doctor role)
    const masked = actor.role === 'Doctor' && !this.defects.CB_PHONE_NOT_MASKED;
    return {
      id: patient.id,
      fullName: patient.fullName,
      dob: formatDate(patient.dob),
      age: ageFor(patient.dob, toDateStr(this.clock.now()), this.defects),
      phone: masked ? maskPhone(patient.phone) : patient.phone,
      email: patient.email,
      visits: shown.map((a) => ({
        date: formatDate(a.date),
        doctor: this.doctors.get(a.doctorId)?.name ?? 'Notanish shifokor',
        status: a.status,
      })),
      totalVisits: visits.length,
      hasMore: !all && visits.length > VISIT_LIMIT,
    };
  }
}
