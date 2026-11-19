import { minutesToTime, timeToMinutes, weekday } from '../shared/time.js';

export const SLOT_LENGTHS = Object.freeze([15, 30, 45]);

/** Slot start times of one working day, e.g. 09:00, 09:30 ... The last slot must end by `end`. */
export function generateTimes({ start, end }, slotMinutes) {
  const times = [];
  for (let t = timeToMinutes(start); t + slotMinutes <= timeToMinutes(end); t += slotMinutes) {
    times.push(minutesToTime(t));
  }
  return times;
}

export function dayConfig(schedule, date) {
  return schedule.days[weekday(date)];
}

/** True when a slot starting at `time` lies completely inside the working window of `day`. */
export function fitsWindow(time, slotMinutes, day) {
  if (!day || day.off) return false;
  const start = timeToMinutes(time);
  return start >= timeToMinutes(day.start) && start + slotMinutes <= timeToMinutes(day.end);
}
