import { queryAppointments } from '../domain/appointmentQuery.js';
import { HIDDEN_STATUSES } from './views.js';

/** Appointments table of the back office. */
export class AdminAppointmentService {
  constructor({ doctors, patients, appointments, defects }) {
    Object.assign(this, { doctors, patients, appointments, defects });
  }

  list(params = {}) {
    const rows = this.appointments
      .list()
      .filter((a) => !HIDDEN_STATUSES.has(a.status))
      .map((a) => ({
        reference: a.reference,
        patient: this.patients.get(a.patientId)?.fullName ?? 'Notanish bemor',
        patientId: a.patientId,
        doctor: this.doctors.get(a.doctorId)?.name ?? 'Notanish shifokor',
        doctorId: a.doctorId,
        date: a.date,
        time: a.time,
        status: a.status,
      }));
    return queryAppointments(rows, params, this.defects);
  }
}
