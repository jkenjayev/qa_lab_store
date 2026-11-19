import { formatDate, formatDateLong } from '../shared/time.js';

/** Shapes appointments for the API. `ctx` = { doctors, patients }. */
export function appointmentView(appointment, { doctors, patients }) {
  const doctor = doctors.get(appointment.doctorId);
  const patient = patients.get(appointment.patientId);
  return {
    reference: appointment.reference,
    doctorId: appointment.doctorId,
    doctorName: doctor?.name ?? 'Notanish shifokor',
    specialty: doctor?.specialty ?? '',
    patientId: appointment.patientId,
    patientName: patient?.fullName ?? 'Notanish bemor',
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
    dateText: formatDate(appointment.date),
    dateLongText: formatDateLong(appointment.date),
  };
}

/** Statuses that silently drop out of every list (data lost by seeded defects). */
export const HIDDEN_STATUSES = new Set(['Orphaned', 'Released']);
