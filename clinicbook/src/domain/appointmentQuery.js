import { formatDate, timeToMinutes } from '../shared/time.js';

export const PAGE_SIZE = 20;
const SORTABLE = new Set(['reference', 'patient', 'doctor', 'date', 'time', 'status']);

/**
 * Table rows for the admin appointments list.
 * @param rows [{ reference, patient, patientId, doctor, doctorId, date, time, status }]
 */
export function queryAppointments(rows, params, defects) {
  const { from, to, doctorId, status } = params;
  let result = rows;
  if (from) result = result.filter((r) => r.date >= from);
  if (to) {
    // CB_RANGE_END_EXCLUSIVE (Date range end date is exclusive)
    result = defects.CB_RANGE_END_EXCLUSIVE ? result.filter((r) => r.date < to) : result.filter((r) => r.date <= to);
  }
  if (doctorId) result = result.filter((r) => r.doctorId === doctorId);
  if (status) result = result.filter((r) => r.status === status);

  const field = SORTABLE.has(params.sort) ? params.sort : 'date';
  const direction = params.dir === 'desc' ? -1 : 1;
  const sorted = [...result].sort((a, b) => direction * compare(a, b, field, defects));

  const pageSize = PAGE_SIZE;
  const total = sorted.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number(params.page) || 1), lastPage);
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = total === 0 ? 0 : (page - 1) * pageSize + pageRows.length;
  // CB_COUNTER_PAGE_SIZE (Counter shows the page size, not the total)
  const shownTotal = defects.CB_COUNTER_PAGE_SIZE && total > 0 ? pageSize : total;

  return {
    rows: pageRows.map((r) => ({ ...r, dateText: formatDate(r.date) })),
    total,
    page,
    pageSize,
    lastPage,
    counter: `${shownTotal} tadan ${first}-${last} koʻrsatilmoqda`,
  };
}

function compare(a, b, field, defects) {
  const byTime = timeToMinutes(a.time) - timeToMinutes(b.time);
  switch (field) {
    case 'date':
      // CB_DATE_SORT_AS_TEXT (Date column sorts as text): compares "05 Dec 2026" strings.
      if (defects.CB_DATE_SORT_AS_TEXT) return formatDate(a.date).localeCompare(formatDate(b.date)) || byTime;
      return a.date.localeCompare(b.date) || byTime;
    case 'time':
      return byTime || a.date.localeCompare(b.date);
    default:
      return String(a[field]).localeCompare(String(b[field])) || a.date.localeCompare(b.date) || byTime;
  }
}
