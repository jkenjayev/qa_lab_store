import { dateKey } from '../clock.js';

/** Start hours of the 2-hour slots: 08:00-10:00 up to 18:00-20:00. */
export const SLOT_HOURS = Object.freeze([8, 10, 12, 14, 16, 18]);

const DAY_NAMES = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const MONTH_NAMES = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
const pad = (n) => String(n).padStart(2, '0');

export const dayLabel = (date) => `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
export const slotId = (key, hour) => `${key}T${pad(hour)}`;
export const slotRange = (hour) => `${pad(hour)}:00-${pad(hour + 2)}:00`;

/** Test data: places per slot. Friday 20 Nov 10:00-12:00 is full. */
export function slotCapacity(key, hour) {
  if (key === '2026-11-20' && hour === 10) return 0;
  return ((Number(key.slice(8)) * 3 + hour) % 5) + 1;
}

/** A slot can be chosen until 2 hours before it starts. */
export function slotIsOpen(start, now, defects) {
  // FC_SAME_DAY_CUTOFF_1H: "Same-day cutoff is 1 hour, not 2 hours"
  const cutoffHours = defects.FC_SAME_DAY_CUTOFF_1H ? 1 : 2;
  return start.getTime() - now.getTime() >= cutoffHours * 3600 * 1000;
}

/**
 * The next 3 days of slots. `booked(id)` returns how many places are already taken.
 * `selectable` is what the UI uses to enable a slot; `full` only drives the "Full" label.
 */
export function buildDays(now, { defects, booked = () => 0 }) {
  const days = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const key = dateKey(day);
    const slots = SLOT_HOURS.map((hour) => {
      const id = slotId(key, hour);
      const remaining = Math.max(0, slotCapacity(key, hour) - booked(id));
      const full = remaining === 0;
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
      // FC_FULL_SLOT_SELECTABLE: "Full delivery slot can be selected" - labelled Full but still enabled.
      const selectable = slotIsOpen(start, now, defects) && (!full || defects.FC_FULL_SLOT_SELECTABLE);
      return { id, label: slotRange(hour), remaining, full, selectable };
    });
    days.push({ date: key, label: dayLabel(day), slots });
  }
  return days;
}

/** Find a slot by id in the built days. */
export function findSlot(days, id) {
  for (const day of days) {
    const slot = day.slots.find((s) => s.id === id);
    if (slot) return { day, slot };
  }
  return null;
}
