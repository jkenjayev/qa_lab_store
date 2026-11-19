import { UnauthorizedError } from '../domain/errors.js';
import { startPage } from '../shared/access.js';
import { MSG } from '../shared/messages.js';

/** Staff login with roles and an idle session timeout. */
export class StaffAuthService {
  constructor({ staff, sessions, verify, clock, defects }) {
    Object.assign(this, { staff, sessions, verify, clock, defects });
  }

  login(email, password) {
    const user = this.staff.findByEmail(email);
    if (!user) {
      // CB_UNKNOWN_EMAIL_MESSAGE (Unknown email gets a different message): reveals that the email is unknown.
      throw new UnauthorizedError(this.defects.CB_UNKNOWN_EMAIL_MESSAGE ? MSG.EMAIL_NOT_FOUND : MSG.INVALID_LOGIN);
    }
    if (!this.verify(String(password ?? ''), user.passwordHash)) throw new UnauthorizedError(MSG.INVALID_LOGIN);
    const token = this.sessions.create({ staffId: user.id }, this.clock.nowMinutes());
    return { token, user: this.#publicUser(user), redirect: startPage(user.role) };
  }

  /** Returns the staff member of a live session and refreshes its activity time. */
  authenticate(token) {
    const session = this.sessions.get(token);
    if (!session) throw new UnauthorizedError(MSG.NOT_SIGNED_IN);
    const now = this.clock.nowMinutes();
    // CB_SESSION_60_MIN (Session lasts 60 minutes, not 30)
    const idleLimit = this.defects.CB_SESSION_60_MIN ? 60 : 30;
    if (now - session.lastActivity >= idleLimit) {
      this.sessions.remove(token);
      throw new UnauthorizedError(MSG.SESSION_EXPIRED, { expired: true });
    }
    this.sessions.touch(token, now);
    const user = this.staff.get(session.staffId);
    if (!user) throw new UnauthorizedError(MSG.NOT_SIGNED_IN);
    return this.#publicUser(user);
  }

  logout(token) {
    this.sessions.remove(token);
  }

  #publicUser(user) {
    return { id: user.id, email: user.email, name: user.name, role: user.role, doctorId: user.doctorId };
  }
}
