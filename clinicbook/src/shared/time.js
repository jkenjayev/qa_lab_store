/** Date and time helpers shared by server and browser. Dates are YYYY-MM-DD, times HH:mm, no time zones. */
const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
const DAYS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
export const pad2 = (n) => String(n).padStart(2, '0');

export function isValidDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = parseDate(str);
  return toDateStr(d) === str;
}
export function isValidTime(str) {
  return typeof str === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(str);
}
export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function toDateStr(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
export function toTimeStr(d) {
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
export function addDays(str, n) {
  const d = parseDate(str);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}
/** 0 = Sunday ... 6 = Saturday */
export function weekday(str) {
  return parseDate(str).getUTCDay();
}
export function weekdayShort(str) {
  return DAYS[weekday(str)];
}
/** 05 Dek 2026 */
export function formatDate(str) {
  const d = parseDate(str);
  return `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
/** Ju 20 Noy 2026 */
export function formatDateLong(str) {
  return `${weekdayShort(str)} ${formatDate(str)}`;
}
export function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
export function minutesToTime(min) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}
/** 14:00 -> 2:00 PM */
export function format12h(t) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad2(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}
/** Minutes since epoch of a wall-clock date and time. Comparable with clock.nowMinutes(). */
export function instantMinutes(date, time) {
  return parseDate(date).getTime() / 60000 + timeToMinutes(time);
}
