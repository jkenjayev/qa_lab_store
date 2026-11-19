# ClinicBook (QA Simulation Lab build)

Runnable web app for the **ClinicBook** project of the Notion QA Simulation Lab: a patient booking portal and a clinic back office.
It is built from the Notion acceptance criteria and designs, and it contains **36 deliberately seeded defects** (the facilitator answer key is in the Notion "Seeded Defects (Facilitator Answer Key)" database). **Do not show this README or the defect table to trainees.**

## Run

```bash
cd qa-lab-apps/clinicbook
npm install
TRAINING_PASSWORD=<choose-a-value> npm start      # http://localhost:3202
```

The facilitator must set `TRAINING_PASSWORD`: it is the shared password of all test accounts. The server refuses to start without it, and the password is never stored in the repository.

| Variable | Default | Meaning |
|---|---|---|
| `TRAINING_PASSWORD` | none, required | Password of every test account |
| `PORT` | 3202 | HTTP port |
| `SEEDED_DEFECTS` | `on` | `off` starts the reference build that meets every acceptance criterion (for the facilitator) |
| `FIXED_NOW` | `2026-11-19T13:10:00` | Fixed clinic clock (UTC+5 wall time). `off` uses the real time |

Tests: `npm test`. Quality gate: `npm run check` (tests plus 80% line coverage).

## Accounts

| Account | Role | Lands on |
|---|---|---|
| admin@clinicbook.test | Admin | /admin/dashboard |
| reception@clinicbook.test | Receptionist | /admin/appointments |
| doctor.rao@clinicbook.test | Doctor (Dr. A. Rao) | /admin/my-schedule |
| amina.patient@example.com | Patient "Patient, Amina" | patient portal |
| bilal.hassan@example.com, carlos.vega@example.com ... | Other seeded patients | patient portal |

All use `TRAINING_PASSWORD`. Patients can also register at /register.

## Pages per feature

| Feature | Status | Where |
|---|---|---|
| F1.1 Doctor directory and filters | Ready for Test | /doctors |
| F1.2 Appointment slot picker | Ready for Test | /doctors/doctor-1 |
| F1.3 Patient registration and login | Active (partial) | /register, /login |
| F1.4 Booking confirmation and email | Active (partial) | /book/confirm, emails at /dev/outbox |
| F1.5 Reschedule and cancel | Blocked (stub) | /my-appointments (log in first) |
| F2.1 Admin login with roles | Ready for Test | /admin/login, /admin/dashboard |
| F2.2 Doctor weekly schedule | Ready for Test | /admin/schedules/doctor-1, /admin/my-schedule |
| F2.3 Appointments list with filters | Active (partial) | /admin/appointments |
| F2.4 Patient record view | Active (partial) | /admin/patients/patient-1 |
| F2.5 Daily report export | Blocked (CSV only) | /admin/reports |

## Training helpers

- `GET/POST /api/dev/clock`: read the clock, or move it with `{"now":"2026-11-19T10:00"}` or `{"advanceMinutes":45}`. The Notion walkthroughs use 13:10 (default), 10:00 (cancel and reschedule) and idle times of 30 to 60 minutes (session timeout).
- `POST /api/dev/reset`: restore the seed data and clear sessions and the outbox.
- `GET /dev/outbox`: emails the app "sent".

## Defect table (facilitator only)

| Id | Notion defect title | File |
|---|---|---|
| `CB_DOCTOR_SEARCH_CASE_SENSITIVE` | Doctor name search is case-sensitive | `src/domain/doctorQuery.js` |
| `CB_EXPERIENCE_SORT_ASCENDING` | Experience sort is ascending | `src/domain/doctorQuery.js` |
| `CB_RESET_KEEPS_NAME` | Reset filters does not clear the name search | `public/js/state/doctorFilters.js` |
| `CB_PAST_SLOTS_SHOWN` | Past slots of today are listed | `src/services/SlotService.js` |
| `CB_TWO_SLOTS_SELECTABLE` | Two slots can be selected at once | `public/js/state/slotSelection.js` |
| `CB_GREY_DAY_CLICKABLE` | Grey day can be clicked | `public/js/state/slotSelection.js` |
| `CB_SLOTS_12H` | Slot times shown in 12-hour AM/PM | `src/shared/slotLabel.js` |
| `CB_PASSWORD_MIN_6` | Password of 6 characters is accepted | `src/shared/rules.js` |
| `CB_EMAIL_UNIQUE_CASE_SENSITIVE` | Email uniqueness is case-sensitive | `src/services/PatientAuthService.js` |
| `CB_FUTURE_DOB_ACCEPTED` | Future date of birth accepted | `src/shared/rules.js` |
| `CB_LOCKOUT_AT_10` | Account locks after 10 failed attempts, not 5 | `src/services/PatientAuthService.js` |
| `CB_EMPTY_REASON_ACCEPTED` | Empty reason is accepted | `src/services/BookingService.js` |
| `CB_CONFIRM_DATE_PREV_DAY` | Confirmation page shows the previous day | `src/services/BookingService.js` |
| `CB_EMAIL_NO_ADDRESS` | Email has no clinic address | `src/services/BookingService.js` |
| `CB_SAME_DAY_DOUBLE_BOOKING` | Same patient can book the same doctor twice on one day | `src/services/BookingService.js` |
| `CB_NO_CANCEL_CUTOFF` | No 24-hour cancellation cutoff | `src/services/PatientAppointmentService.js` |
| `CB_NO_CANCEL_CONFIRM` | Cancel has no confirmation dialog | `public/js/state/cancel.js` |
| `CB_RESCHEDULE_FREES_EARLY` | Reschedule frees the old slot immediately | `src/services/PatientAppointmentService.js` |
| `CB_UNKNOWN_EMAIL_MESSAGE` | Unknown email gets a different message | `src/services/StaffAuthService.js` |
| `CB_RECEPTION_OPENS_DASHBOARD` | Receptionist can open the Admin dashboard by URL | `src/shared/access.js` |
| `CB_SESSION_60_MIN` | Session lasts 60 minutes, not 30 | `src/services/StaffAuthService.js` |
| `CB_BACK_AFTER_LOGOUT` | Back button shows a protected page after logout | `src/app.js` |
| `CB_SCHEDULE_EQUAL_TIMES` | End time equal to start time is accepted | `src/services/ScheduleService.js` |
| `CB_SCHEDULE_ORPHANS_APPOINTMENTS` | Shortening hours silently orphans booked appointments | `src/services/ScheduleService.js` |
| `CB_DOCTOR_EDITS_OTHER_SCHEDULE` | Doctor can edit another doctor's schedule by changing the URL | `src/services/ScheduleService.js` |
| `CB_DEFAULT_RANGE_EMPTY` | Default date range is empty instead of today | `public/js/state/appointmentFilters.js` |
| `CB_RANGE_END_EXCLUSIVE` | Date range end date is exclusive | `src/domain/appointmentQuery.js` |
| `CB_DATE_SORT_AS_TEXT` | Date column sorts as text | `src/domain/appointmentQuery.js` |
| `CB_COUNTER_PAGE_SIZE` | Counter shows the page size, not the total | `src/domain/appointmentQuery.js` |
| `CB_AGE_ROUNDED_UP` | Age is rounded up | `src/domain/age.js` |
| `CB_HISTORY_OLDEST_FIRST` | Visit history is oldest first | `src/services/PatientRecordService.js` |
| `CB_PHONE_NOT_MASKED` | Phone is not masked for the Doctor role | `src/services/PatientRecordService.js` |
| `CB_DOCTOR_OPENS_ANY_PATIENT` | Doctor can open any patient record by id | `src/services/PatientRecordService.js` |
| `CB_RECEPTION_SEES_EXPORT` | Receptionist can see Reports and Export | `src/shared/access.js` |
| `CB_CSV_NAME_DD_MM_YYYY` | CSV file name uses DD-MM-YYYY | `src/domain/csv.js` |
| `CB_CSV_COMMAS_UNQUOTED` | Names containing commas are not quoted in CSV | `src/domain/csv.js` |

Each defect is one commented `if (defects.ID)` branch next to the correct code. `SEEDED_DEFECTS=off` switches all of them off.

## Design

- `src/shared`: pure modules used by server and browser (time, rules, access matrix, messages).
- `src/domain`: pure rules (slots, age, csv, queries). `src/data`: seed data and in-memory repositories.
- `src/services`: business rules, wired in `src/services/index.js`. `src/routes`: thin Express routers. `src/app.js`: app factory. `server.js`: starts it.
- `public`: vanilla JS single page app. `views` are pure HTML builders, `state` holds UI logic, `pages` and `ui.js` are DOM glue.
- Data is in memory; restart or reset to start over.


## Storage in Notion

Data is stored in Notion (page "App Data (written by FreshCart and ClinicBook)", databases `CB Doctors`, `CB Schedules`,
`CB Appointments`, `CB Patients`, `CB Staff`, `CB Emails`). Memory is a write-through cache: the app loads the rows at
start and writes every change back through a slow queue (Notion allows about 3 requests per second).

1. Create an internal integration at https://www.notion.so/profile/integrations and share the page
   "App Data (written by FreshCart and ClinicBook)" with it.
2. Copy `.env.example` to `.env.local` and put the token in `NOTION_TOKEN` yourself (never commit it, never paste it in chat).
   Also set `TRAINING_PASSWORD`.
3. `npm run notion:verify` writes, reads back and archives one temporary row: prints OK when token and databases work.
4. `npm run notion:seed` fills the databases (safe to repeat: matching rows are skipped, changed rows are restored).
5. `npm start` starts the app on the Notion data. `GET /api/dev/storage` shows the mode, pending writes and the last error.
   `POST /api/dev/reset` restores the seed in memory at once and in Notion after the queue drains.

Without `NOTION_TOKEN` (or with `STORAGE=memory`, `npm run start:memory`) the data stays in memory only and a warning is printed.
Never written to Notion: sessions, login attempts, staff password hashes, and the hash of the shared training password
(seed patients get it back from `TRAINING_PASSWORD` when the app loads). Patients who register with their own password
have their salted hash stored; do not enter real personal data into this training app.

Postman collection: `../postman/ClinicBook.postman_collection.json`.
