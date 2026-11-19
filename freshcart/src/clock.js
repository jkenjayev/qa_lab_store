/** Walkthrough clock from the Notion implementation pages: Thursday 19 Nov 2026, 15:00. */
export const DEFAULT_NOW = '2026-11-19T15:00:00';

/** FIXED_NOW=off uses the real time; FIXED_NOW=<iso> overrides the default fixed clock. */
export function createClock(env = {}) {
  const raw = env.FIXED_NOW;
  if (String(raw).toLowerCase() === 'off') return { now: () => new Date() };
  const fixed = new Date(raw ? raw : DEFAULT_NOW);
  if (Number.isNaN(fixed.getTime())) throw new Error(`FIXED_NOW yaroqli sana emas: ${raw}`);
  return { now: () => new Date(fixed.getTime()) };
}

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local time without zone: YYYY-MM-DDTHH:mm:ss. */
export function toLocalIso(date) {
  return `${dateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
