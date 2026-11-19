/**
 * Wall-clock of the clinic (UTC+5). Times are "naive": Date objects whose UTC fields hold the clinic
 * local wall time, so the app behaves the same on every machine. The clock can be moved at run time
 * (dev routes) so trainees can test session timeouts and same-day rules.
 */
export function createClock({ fixedNow = '2026-11-19T13:10:00', real = false, realNow = () => Date.now() } = {}) {
  const CLINIC_OFFSET_MS = 5 * 60 * 60 * 1000;
  let fixedMs = Date.parse(`${fixedNow}Z`);
  let offsetMs = 0;
  return {
    isReal: real,
    now() {
      return new Date(real ? realNow() + CLINIC_OFFSET_MS + offsetMs : fixedMs);
    },
    nowMinutes() {
      return Math.floor(this.now().getTime() / 60000);
    },
    set(iso) {
      const ms = Date.parse(`${iso.replace(/Z$/, '')}Z`);
      if (Number.isNaN(ms)) throw new RangeError('Sana va vaqt notoʻgʻri');
      if (real) offsetMs = ms - (realNow() + CLINIC_OFFSET_MS);
      else fixedMs = ms;
    },
    advance(minutes) {
      if (real) offsetMs += minutes * 60000;
      else fixedMs += minutes * 60000;
    },
  };
}
