import { LockedError, UnauthorizedError, ValidationError } from '../domain/errors.js';
import { MSG } from '../shared/messages.js';
import { validateRegistration } from '../shared/rules.js';
import { toDateStr } from '../shared/time.js';

/** Patient accounts: registration, login with lockout, sessions. */
export class PatientAuthService {
  constructor({ patients, sessions, attempts, hash, verify, clock, defects }) {
    Object.assign(this, { patients, sessions, attempts, hash, verify, clock, defects });
  }

  register(input) {
    const emailTaken = (email) =>
      // CB_EMAIL_UNIQUE_CASE_SENSITIVE (Email uniqueness is case-sensitive): exact text comparison.
      this.defects.CB_EMAIL_UNIQUE_CASE_SENSITIVE
        ? Boolean(this.patients.findByEmailExact(email))
        : Boolean(this.patients.findByEmailIgnoreCase(email));
    const errors = validateRegistration(input, {
      today: toDateStr(this.clock.now()),
      emailTaken,
      defects: this.defects,
    });
    if (Object.keys(errors).length > 0) throw new ValidationError('Iltimos, belgilangan maydonlarni toʻgʻrilang', errors);
    const patient = this.patients.add({
      fullName: input.fullName.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      dob: input.dob,
      passwordHash: this.hash(input.password),
    });
    return { id: patient.id, fullName: patient.fullName, email: patient.email };
  }

  login(email, password) {
    const key = String(email ?? '').trim().toLowerCase();
    const now = this.clock.nowMinutes();
    const record = this.attempts.get(key);
    if (record.lockedUntil > now) throw new LockedError(MSG.LOCKED);

    const patient = key ? this.patients.findByEmailIgnoreCase(key) : null;
    if (patient && this.verify(String(password ?? ''), patient.passwordHash)) {
      this.attempts.reset(key);
      const token = this.sessions.create({ patientId: patient.id }, now);
      return { token, patient: { id: patient.id, fullName: patient.fullName } };
    }

    record.count += 1;
    // CB_LOCKOUT_AT_10 (Account locks after 10 failed attempts, not 5)
    const limit = this.defects.CB_LOCKOUT_AT_10 ? 10 : 5;
    if (record.count >= limit) {
      record.count = 0;
      record.lockedUntil = now + 15;
      throw new LockedError(MSG.LOCKED);
    }
    throw new UnauthorizedError(MSG.INVALID_LOGIN);
  }

  authenticate(token) {
    const session = this.sessions.get(token);
    if (!session) throw new UnauthorizedError(MSG.NOT_SIGNED_IN);
    const patient = this.patients.get(session.patientId);
    if (!patient) throw new UnauthorizedError(MSG.NOT_SIGNED_IN);
    return { id: patient.id, fullName: patient.fullName, email: patient.email };
  }

  logout(token) {
    this.sessions.remove(token);
  }
}
