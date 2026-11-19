import { ForbiddenError } from '../domain/errors.js';
import { canAccess } from '../shared/access.js';
import { MSG } from '../shared/messages.js';
import { toDateStr } from '../shared/time.js';
import { HIDDEN_STATUSES } from './views.js';

/** Numbers on the Admin dashboard. */
export class DashboardService {
  constructor({ doctors, patients, appointments, clock, defects }) {
    Object.assign(this, { doctors, patients, appointments, clock, defects });
  }

  stats(actor) {
    if (!canAccess(actor.role, 'dashboard', this.defects)) throw new ForbiddenError(MSG.FORBIDDEN);
    const today = toDateStr(this.clock.now());
    const visible = this.appointments.list().filter((a) => !HIDDEN_STATUSES.has(a.status));
    return {
      appointmentsToday: visible.filter((a) => a.date === today).length,
      upcomingAppointments: visible.filter((a) => a.date >= today && a.status === 'Booked').length,
      doctors: this.doctors.list().length,
      patients: this.patients.list().length,
    };
  }
}
