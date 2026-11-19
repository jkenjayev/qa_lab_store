import { format12h } from './time.js';

/** Label of a slot button: 24-hour as designed. */
export function slotLabel(time, defects) {
  // CB_SLOTS_12H (Slot times shown in 12-hour AM/PM)
  return defects.CB_SLOTS_12H ? format12h(time) : time;
}
