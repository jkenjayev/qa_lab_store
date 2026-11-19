import { completedYears } from '../shared/rules.js';

/** Age shown on the patient record. */
export function ageFor(dob, today, defects) {
  const years = completedYears(dob, today);
  if (!defects.CB_AGE_ROUNDED_UP) return years;
  // CB_AGE_ROUNDED_UP (Age is rounded up): any started year counts as a full year.
  const [, bm, bd] = dob.split('-').map(Number);
  const [, tm, td] = today.split('-').map(Number);
  return tm === bm && td === bd ? years : years + 1;
}
