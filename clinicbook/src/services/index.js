import { randomUUID } from 'node:crypto';
import { createSeed } from '../data/seed.js';
import { createRepositories } from '../data/repositories.js';
import { hashPassword, verifyPassword } from '../domain/password.js';
import { AdminAppointmentService } from './AdminAppointmentService.js';
import { BookingService } from './BookingService.js';
import { DashboardService } from './DashboardService.js';
import { DoctorService } from './DoctorService.js';
import { PatientAppointmentService } from './PatientAppointmentService.js';
import { PatientAuthService } from './PatientAuthService.js';
import { PatientRecordService } from './PatientRecordService.js';
import { ReportService } from './ReportService.js';
import { ScheduleService } from './ScheduleService.js';
import { SlotService } from './SlotService.js';
import { StaffAuthService } from './StaffAuthService.js';

/** Composition root for services: wires repositories, clock and defect flags into every service. */
export function buildServices({ clock, defects, trainingPassword, generateToken = randomUUID, initialData = null, sink }) {
  // initialData comes from the stored rows (Notion); without it the fixed seed is used.
  const seed = initialData ?? createSeed({ passwordHash: hashPassword(trainingPassword) });
  const repos = createRepositories(seed, generateToken, sink);
  const shared = { ...repos, clock, defects };
  const slots = new SlotService(shared);
  const auth = { hash: hashPassword, verify: verifyPassword };
  return {
    repos,
    seedData: seed,
    slots,
    doctors: new DoctorService({ ...shared, slots }),
    patientAuth: new PatientAuthService({ ...shared, ...auth, sessions: repos.patientSessions }),
    staffAuth: new StaffAuthService({ ...shared, ...auth, sessions: repos.staffSessions }),
    booking: new BookingService({ ...shared, slots }),
    myAppointments: new PatientAppointmentService({ ...shared, slots }),
    schedules: new ScheduleService(shared),
    adminAppointments: new AdminAppointmentService(shared),
    patientRecords: new PatientRecordService(shared),
    reports: new ReportService(shared),
    dashboard: new DashboardService(shared),
  };
}
