/** Filters of the admin appointments table. The default range is today to today. */
export function initialFilters(today, defects) {
  // CB_DEFAULT_RANGE_EMPTY (Default date range is empty instead of today)
  const range = defects.CB_DEFAULT_RANGE_EMPTY ? { from: '', to: '' } : { from: today, to: today };
  return { ...range, doctorId: '', status: '', sort: 'date', dir: 'asc', page: 1 };
}

export function toQuery(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== '' && value != null) params.set(key, String(value));
  return params.toString();
}

/** Click on a column header: same column flips the direction, a new column starts ascending. */
export function sortBy(filters, column) {
  const dir = filters.sort === column && filters.dir === 'asc' ? 'desc' : 'asc';
  return { ...filters, sort: column, dir, page: 1 };
}
