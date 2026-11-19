import { ConflictError, NotFoundError, ValidationError } from '../domain/errors.js';
import { MSG } from '../shared/messages.js';
import { addDays, formatDateLong, isValidDate, isValidTime } from '../shared/time.js';
import { appointmentView } from './views.js';

/** Creating bookings and sending the confirmation email. */
export class BookingService {
  constructor({ doctors, patients, appointments, slots, outbox, clock, defects }) {
    Object.assign(this, { doctors, patients, appointments, slots, outbox, clock, defects });
  }

  book({ patientId, doctorId, date, time, reason }) {
    const doctor = this.doctors.get(doctorId);
    if (!doctor) throw new NotFoundError(`Shifokor ${doctorId} topilmadi`);
    const patient = this.patients.get(patientId);
    if (!patient) throw new NotFoundError('Bemor topilmadi');
    if (!isValidDate(date) || !isValidTime(time)) throw new ValidationError('Toʻgʻri sana va vaqtni tanlang');

    const text = String(reason ?? '').trim();
    // CB_EMPTY_REASON_ACCEPTED (Empty reason is accepted)
    if (!text && !this.defects.CB_EMPTY_REASON_ACCEPTED) {
      throw new ValidationError(MSG.REASON_REQUIRED, { reason: MSG.REASON_REQUIRED });
    }
    if (text.length > 200) throw new ValidationError(MSG.REASON_TOO_LONG, { reason: MSG.REASON_TOO_LONG });

    if (!this.slots.isFree(doctorId, date, time)) throw new ConflictError(MSG.SLOT_TAKEN);

    // CB_SAME_DAY_DOUBLE_BOOKING (Same patient can book the same doctor twice on one day)
    if (!this.defects.CB_SAME_DAY_DOUBLE_BOOKING) {
      const duplicate = this.appointments
        .list()
        .some((a) => a.patientId === patientId && a.doctorId === doctorId && a.date === date && a.status === 'Booked');
      if (duplicate) throw new ConflictError(MSG.DOUBLE_BOOKING);
    }

    const appointment = this.appointments.add({
      reference: this.appointments.nextReference(),
      patientId,
      doctorId,
      date,
      time,
      status: 'Booked',
      reason: text,
    });
    this.#sendConfirmation(appointment, patient, doctor);

    // CB_CONFIRM_DATE_PREV_DAY (Confirmation page shows the previous day): a time zone shift on the page only.
    const shownDate = this.defects.CB_CONFIRM_DATE_PREV_DAY ? addDays(date, -1) : date;
    return {
      ...appointmentView(appointment, { doctors: this.doctors, patients: this.patients }),
      confirmationDateText: formatDateLong(shownDate),
    };
  }

  #sendConfirmation(appointment, patient, doctor) {
    const lines = [
      `Qabul raqami: ${appointment.reference}`,
      `Shifokor: ${doctor.name}, ${doctor.specialty}`,
      `Sana: ${formatDateLong(appointment.date)}`,
      `Vaqt: ${appointment.time} (klinikaning mahalliy vaqti, UTC+5)`,
    ];
    // CB_EMAIL_NO_ADDRESS (Email has no clinic address)
    if (!this.defects.CB_EMAIL_NO_ADDRESS) lines.push(`Klinika manzili: ${MSG.CLINIC_ADDRESS}`);
    lines.push(`Qabulni bekor qilish: /my-appointments?cancel=${appointment.reference}`);
    this.outbox.add({
      to: patient.email,
      subject: `Sizning ClinicBook qabulingiz ${appointment.reference}`,
      body: lines.join('\n'),
      sentAt: this.clock.now().toISOString().slice(0, 16),
    });
  }
}
