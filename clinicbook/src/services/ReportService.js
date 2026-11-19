import { buildDailyCsv, reportFileName } from '../domain/csv.js';
import { ForbiddenError, ValidationError } from '../domain/errors.js';
import { canAccess } from '../shared/access.js';
import { MSG } from '../shared/messages.js';
import { isValidDate, toDateStr } from '../shared/time.js';
import { HIDDEN_STATUSES } from './views.js';

/** Daily report export (CSV only in this build, PDF waits for the library license). */
export class ReportService {
  constructor({ doctors, patients, appointments, defects }) {
    Object.assign(this, { doctors, patients, appointments, defects });
  }

  dailyCsv(actor, date, format = 'csv') {
    if (!canAccess(actor.role, 'reports', this.defects)) throw new ForbiddenError(MSG.FORBIDDEN);
    if (format !== 'csv') throw new ValidationError('PDF eksporti tez orada qoʻshiladi');
    if (!isValidDate(date)) throw new ValidationError('Toʻgʻri sanani tanlang');
    const rows = this.appointments
      .list()
      .filter((a) => a.date === date && !HIDDEN_STATUSES.has(a.status))
      .sort((a, b) => a.time.localeCompare(b.time) || a.reference.localeCompare(b.reference))
      .map((a) => ({
        time: a.time,
        patient: this.patients.get(a.patientId)?.fullName ?? 'Notanish bemor',
        doctor: this.doctors.get(a.doctorId)?.name ?? 'Notanish shifokor',
        status: a.status,
      }));
    return {
      filename: reportFileName(date, 'csv', this.defects),
      content: buildDailyCsv({ date, rows, defects: this.defects }),
      contentType: 'text/csv; charset=utf-8',
    };
  }

  /** Date used when the report page first opens. */
  static defaultDate(clock) {
    return toDateStr(clock.now());
  }
}
