import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../domain/errors.js';
import { SLOT_LENGTHS, fitsWindow } from '../domain/slots.js';
import { DAY_LABEL } from '../shared/labels.js';
import { MSG } from '../shared/messages.js';
import { isValidTime, timeToMinutes, toDateStr, weekday } from '../shared/time.js';
import { HIDDEN_STATUSES, appointmentView } from './views.js';

const DAY_NAMES = DAY_LABEL;

/** Weekly working hours of doctors. */
export class ScheduleService {
  constructor({ doctors, patients, schedules, appointments, clock, defects }) {
    Object.assign(this, { doctors, patients, schedules, appointments, clock, defects });
  }

  #authorize(actor, doctorId) {
    if (actor.role === 'Admin') return;
    // CB_DOCTOR_EDITS_OTHER_SCHEDULE (Doctor can edit another doctor's schedule by changing the URL)
    if (actor.role === 'Doctor' && (actor.doctorId === doctorId || this.defects.CB_DOCTOR_EDITS_OTHER_SCHEDULE)) return;
    throw new ForbiddenError(MSG.FORBIDDEN);
  }

  #doctor(doctorId) {
    const doctor = this.doctors.get(doctorId);
    if (!doctor) throw new NotFoundError(`Shifokor ${doctorId} topilmadi`);
    return doctor;
  }

  #upcoming(doctorId) {
    const today = toDateStr(this.clock.now());
    return this.appointments
      .list()
      .filter((a) => a.doctorId === doctorId && a.status === 'Booked' && a.date >= today && !HIDDEN_STATUSES.has(a.status));
  }

  get(actor, doctorId) {
    this.#authorize(actor, doctorId);
    const doctor = this.#doctor(doctorId);
    const views = this.#upcoming(doctorId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .map((a) => appointmentView(a, { doctors: this.doctors, patients: this.patients }));
    return {
      doctor: { id: doctor.id, name: doctor.name },
      doctors: actor.role === 'Admin' ? this.doctors.list().map((d) => ({ id: d.id, name: d.name })) : undefined,
      schedule: this.schedules.get(doctorId),
      appointments: views,
    };
  }

  #validate(body) {
    const slotMinutes = Number(body?.slotMinutes);
    if (!SLOT_LENGTHS.includes(slotMinutes)) throw new ValidationError('Qabul davomiyligi 15, 30 yoki 45 daqiqa boʻlishi kerak');
    const days = {};
    const fields = {};
    for (let d = 0; d < 7; d += 1) {
      const input = body?.days?.[d];
      if (!input) throw new ValidationError('Har bir kun uchun sozlama kerak');
      if (input.off) {
        days[d] = { off: true };
        continue;
      }
      if (!isValidTime(input.start) || !isValidTime(input.end)) {
        fields[d] = 'Boshlanish va tugash vaqtini kiriting';
        continue;
      }
      const start = timeToMinutes(input.start);
      const end = timeToMinutes(input.end);
      // CB_SCHEDULE_EQUAL_TIMES (End time equal to start time is accepted): only end < start is refused.
      const invalid = this.defects.CB_SCHEDULE_EQUAL_TIMES ? end < start : end <= start;
      if (invalid) fields[d] = MSG.END_BEFORE_START;
      days[d] = { off: false, start: input.start, end: input.end };
    }
    if (Object.keys(fields).length > 0) {
      const first = Object.entries(fields)[0];
      throw new ValidationError(first[1] === MSG.END_BEFORE_START ? MSG.END_BEFORE_START : first[1], Object.fromEntries(Object.entries(fields).map(([d, m]) => [DAY_NAMES[d], m])));
    }
    return { slotMinutes, days };
  }

  #conflicts(doctorId, schedule) {
    return this.#upcoming(doctorId).filter((a) => {
      const day = schedule.days[weekday(a.date)];
      // A zero-length window (only possible through the equal-times defect) is not evaluated.
      if (day && !day.off && timeToMinutes(day.end) <= timeToMinutes(day.start)) return false;
      return !fitsWindow(a.time, schedule.slotMinutes, day);
    });
  }

  save(actor, doctorId, body, { confirm = false } = {}) {
    this.#authorize(actor, doctorId);
    this.#doctor(doctorId);
    const schedule = this.#validate(body);
    const conflicts = this.#conflicts(doctorId, schedule);

    if (conflicts.length > 0) {
      if (this.defects.CB_SCHEDULE_ORPHANS_APPOINTMENTS) {
        // CB_SCHEDULE_ORPHANS_APPOINTMENTS (Shortening hours silently orphans booked appointments)
        for (const a of conflicts) {
          a.status = 'Orphaned';
          this.appointments.save(a);
        }
      } else if (!confirm) {
        throw new ConflictError(MSG.SCHEDULE_CONFLICT, {
          conflicts: conflicts.map((a) => ({
            reference: a.reference,
            patient: this.patients.get(a.patientId)?.fullName ?? '',
            date: a.date,
            time: a.time,
          })),
        });
      }
    }
    this.schedules.set(doctorId, schedule);
    return this.get(actor, doctorId);
  }
}
