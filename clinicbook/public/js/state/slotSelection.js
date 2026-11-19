/** Slot picker selection. */
export function toggleSlot(selected, time, defects) {
  // CB_TWO_SLOTS_SELECTABLE (Two slots can be selected at once): selecting adds to the selection.
  if (defects.CB_TWO_SLOTS_SELECTABLE) {
    return selected.includes(time) ? selected.filter((t) => t !== time) : [...selected, time];
  }
  return [time];
}

/** The slot the next screen uses: the first one chosen. */
export function continueTime(selected) {
  return selected.length > 0 ? selected[0] : null;
}

export function isDayClickable(day, defects) {
  // CB_GREY_DAY_CLICKABLE (Grey day can be clicked)
  return day.hasSlots || Boolean(defects.CB_GREY_DAY_CLICKABLE);
}
