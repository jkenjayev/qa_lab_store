import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../domain/errors.js';
import { MSG } from '../shared/messages.js';
import { instantMinutes, isValidDate, isValidTime } from '../shared/time.js';
import { HIDDEN_STATUSES, appointmentView } from './views.js';

/** "My appointments": list, cancel, reschedule. */
export class PatientAppointmentService {
  constructor({ doctors, patients, appointments, slots, clock, defects }) {
    Object.assign(this, { doctors, patients, appointments, slots, clock, defects });
  }

  #view(a) {
    return appointmentView(a, { doctors: this.doctors, patients: this.patients });
  }

  #own(patientId, reference) {
    const appointment = this.appointments.get(reference);
    if (!appointment) throw new NotFoundError(`Qabul ${reference} topilmadi`);
    if (appointment.patientId !== patientId) throw new ForbiddenError(MSG.FORBIDDEN);
    return appointment;
  }

  listMine(patientId) {
    const now = this.clock.nowMinutes();
    const mine = this.appointments
      .list()
      .filter((a) => a.patientId === patientId && !HIDDEN_STATUSES.has(a.status));
    const startOf = (a) => instantMinutes(a.date, a.time);
    const upcoming = mine.filter((a) => a.status === 'Booked' && startOf(a) >= now).sort((a, b) => startOf(a) - startOf(b));
    const past = mine.filter((a) => !upcoming.includes(a)).sort((a, b) => startOf(b) - startOf(a));
    return { upcoming: upcoming.map((a) => this.#view(a)), past: past.map((a) => this.#view(a)) };
  }

  cancel(patientId, reference) {
    const appointment = this.#own(patientId, reference);
    if (appointment.status !== 'Booked') throw new ConflictError('Faqat band qilingan qabulni bekor qilish mumkin');
    const hoursLeft = (instantMinutes(appointment.date, appointment.time) - this.clock.nowMinutes()) / 60;
    // CB_NO_CANCEL_CUTOFF (No 24-hour cancellation cutoff)
    if (!this.defects.CB_NO_CANCEL_CUTOFF && hoursLeft < 24) throw new ConflictError(MSG.CANCEL_LATE);
    appointment.status = 'Cancelled';
    this.appointments.save(appointment);
    return this.#view(appointment);
  }

  /** Called when the patient opens the slot picker to reschedule. */
  rescheduleStart(patientId, reference) {
    const appointment = this.#own(patientId, reference);
    if (appointment.status !== 'Booked') throw new ConflictError('Faqat band qilingan qabulni boshqa vaqtga koʻchirish mumkin');
    // CB_RESCHEDULE_FREES_EARLY (Reschedule frees the old slot immediately): the appointment is released
    // as soon as the picker opens, and it disappears from every list.
    if (this.defects.CB_RESCHEDULE_FREES_EARLY) {
      appointment.status = 'Released';
      this.appointments.save(appointment);
    }
    return { doctorId: appointment.doctorId, reference };
  }

  /** The old slot stays booked until this succeeds. */
  reschedule(patientId, reference, { date, time }) {
    const appointment = this.#own(patientId, reference);
    if (appointment.status !== 'Booked') throw new ConflictError('Faqat band qilingan qabulni boshqa vaqtga koʻchirish mumkin');
    if (!isValidDate(date) || !isValidTime(time)) throw new ValidationError('Toʻgʻri sana va vaqtni tanlang');
    if (!this.slots.isFree(appointment.doctorId, date, time)) throw new ConflictError(MSG.SLOT_TAKEN);
    appointment.date = date;
    appointment.time = time;
    this.appointments.save(appointment);
    return this.#view(appointment);
  }
}
