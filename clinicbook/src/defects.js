/**
 * The 36 seeded defects of ClinicBook. The id is used in code and tests, the title is the row title
 * in the Notion "Seeded Defects (Facilitator Answer Key)" database. Mode "off" is the reference
 * build that satisfies every acceptance criterion.
 */
export const DEFECT_TITLES = Object.freeze({
  // F1.1 Doctor directory and filters
  CB_DOCTOR_SEARCH_CASE_SENSITIVE: 'Doctor name search is case-sensitive',
  CB_EXPERIENCE_SORT_ASCENDING: 'Experience sort is ascending',
  CB_RESET_KEEPS_NAME: 'Reset filters does not clear the name search',
  // F1.2 Appointment slot picker
  CB_PAST_SLOTS_SHOWN: 'Past slots of today are listed',
  CB_TWO_SLOTS_SELECTABLE: 'Two slots can be selected at once',
  CB_GREY_DAY_CLICKABLE: 'Grey day can be clicked',
  CB_SLOTS_12H: 'Slot times shown in 12-hour AM/PM',
  // F1.3 Patient registration and login
  CB_PASSWORD_MIN_6: 'Password of 6 characters is accepted',
  CB_EMAIL_UNIQUE_CASE_SENSITIVE: 'Email uniqueness is case-sensitive',
  CB_FUTURE_DOB_ACCEPTED: 'Future date of birth accepted',
  CB_LOCKOUT_AT_10: 'Account locks after 10 failed attempts, not 5',
  // F1.4 Booking confirmation and email
  CB_EMPTY_REASON_ACCEPTED: 'Empty reason is accepted',
  CB_CONFIRM_DATE_PREV_DAY: 'Confirmation page shows the previous day',
  CB_EMAIL_NO_ADDRESS: 'Email has no clinic address',
  CB_SAME_DAY_DOUBLE_BOOKING: 'Same patient can book the same doctor twice on one day',
  // F1.5 Reschedule and cancel appointment
  CB_NO_CANCEL_CUTOFF: 'No 24-hour cancellation cutoff',
  CB_NO_CANCEL_CONFIRM: 'Cancel has no confirmation dialog',
  CB_RESCHEDULE_FREES_EARLY: 'Reschedule frees the old slot immediately',
  // F2.1 Admin login with roles
  CB_UNKNOWN_EMAIL_MESSAGE: 'Unknown email gets a different message',
  CB_RECEPTION_OPENS_DASHBOARD: 'Receptionist can open the Admin dashboard by URL',
  CB_SESSION_60_MIN: 'Session lasts 60 minutes, not 30',
  CB_BACK_AFTER_LOGOUT: 'Back button shows a protected page after logout',
  // F2.2 Doctor weekly schedule management
  CB_SCHEDULE_EQUAL_TIMES: 'End time equal to start time is accepted',
  CB_SCHEDULE_ORPHANS_APPOINTMENTS: 'Shortening hours silently orphans booked appointments',
  CB_DOCTOR_EDITS_OTHER_SCHEDULE: "Doctor can edit another doctor's schedule by changing the URL",
  // F2.3 Appointments list with filters
  CB_DEFAULT_RANGE_EMPTY: 'Default date range is empty instead of today',
  CB_RANGE_END_EXCLUSIVE: 'Date range end date is exclusive',
  CB_DATE_SORT_AS_TEXT: 'Date column sorts as text',
  CB_COUNTER_PAGE_SIZE: 'Counter shows the page size, not the total',
  // F2.4 Patient record view
  CB_AGE_ROUNDED_UP: 'Age is rounded up',
  CB_HISTORY_OLDEST_FIRST: 'Visit history is oldest first',
  CB_PHONE_NOT_MASKED: 'Phone is not masked for the Doctor role',
  CB_DOCTOR_OPENS_ANY_PATIENT: 'Doctor can open any patient record by id',
  // F2.5 Daily report export
  CB_RECEPTION_SEES_EXPORT: 'Receptionist can see Reports and Export',
  CB_CSV_NAME_DD_MM_YYYY: 'CSV file name uses DD-MM-YYYY',
  CB_CSV_COMMAS_UNQUOTED: 'Names containing commas are not quoted in CSV',
});

export const DEFECT_IDS = Object.freeze(Object.keys(DEFECT_TITLES));

/** @param {'on'|'off'} mode */
export function createDefects(mode = 'on') {
  const enabled = mode !== 'off';
  return Object.freeze(Object.fromEntries(DEFECT_IDS.map((id) => [id, enabled])));
}

/** Reference build with only the given defect ids switched on. Used by tests. */
export function onlyDefects(...ids) {
  return Object.freeze({ ...createDefects('off'), ...Object.fromEntries(ids.map((id) => [id, true])) });
}

export function defectsFromEnv(env) {
  return createDefects(String(env.SEEDED_DEFECTS ?? 'on').toLowerCase() === 'off' ? 'off' : 'on');
}
