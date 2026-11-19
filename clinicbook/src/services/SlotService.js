import { NotFoundError, ValidationError } from '../domain/errors.js';
import { dayConfig, generateTimes } from '../domain/slots.js';
import { addDays, instantMinutes, isValidDate, toDateStr, weekdayShort } from '../shared/time.js';

/** Free slots of a doctor. Knows working hours, booked slots and "now". */
export class SlotService {
  constructor({ doctors, schedules, appointments, clock, defects }) {
    Object.assign(this, { doctors, schedules, appointments, clock, defects });
  }

  today() {
    return toDateStr(this.clock.now());
  }

  #requireDoctor(doctorId) {
    const doctor = this.doctors.get(doctorId);
    if (!doctor) throw new NotFoundError(`Shifokor ${doctorId} topilmadi`);
    return doctor;
  }

  #workingTimes(doctorId, date) {
    const schedule = this.schedules.get(doctorId);
    const day = schedule && dayConfig(schedule, date);
    if (!day || day.off) return [];
    const booked = new Set(
      this.appointments
        .list()
        .filter((a) => a.doctorId === doctorId && a.date === date && a.status === 'Booked')
        .map((a) => a.time),
    );
    return generateTimes(day, schedule.slotMinutes).filter((time) => !booked.has(time));
  }

  /** Truly bookable slots: working hours, not booked, not in the past. Used for validation. */
  freeTimes(doctorId, date) {
    this.#requireDoctor(doctorId);
    const now = this.clock.nowMinutes();
    return this.#workingTimes(doctorId, date).filter((time) => instantMinutes(date, time) > now);
  }

  isFree(doctorId, date, time) {
    return this.freeTimes(doctorId, date).includes(time);
  }

  /** Slots shown in the picker for one day. */
  displayTimes(doctorId, date) {
    if (!isValidDate(date)) throw new ValidationError('Toʻgʻri sanani tanlang');
    this.#requireDoctor(doctorId);
    // CB_PAST_SLOTS_SHOWN (Past slots of today are listed): slots earlier than now are not filtered out.
    if (this.defects.CB_PAST_SLOTS_SHOWN) return this.#workingTimes(doctorId, date);
    return this.freeTimes(doctorId, date);
  }

  /** 7-day strip starting today. A day without free slots has hasSlots false (grey). */
  week(doctorId) {
    this.#requireDoctor(doctorId);
    const start = this.today();
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return { date, weekday: weekdayShort(date), day: Number(date.slice(8)), hasSlots: this.freeTimes(doctorId, date).length > 0 };
    });
  }

  /** First date (within 60 days) with a free slot, or null. */
  nextAvailable(doctorId) {
    const start = this.today();
    for (let i = 0; i < 60; i += 1) {
      const date = addDays(start, i);
      if (this.freeTimes(doctorId, date).length > 0) return date;
    }
    return null;
  }
}
