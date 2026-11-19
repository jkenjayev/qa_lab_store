export const emptyFilters = () => ({ specialty: '', name: '', sort: 'next' });

/** "Reset filters": clears specialty and name search, keeps the sort. */
export function resetFilters(filters, defects) {
  // CB_RESET_KEEPS_NAME (Reset filters does not clear the name search)
  return { ...filters, specialty: '', name: defects.CB_RESET_KEEPS_NAME ? filters.name : '' };
}

export function toQuery(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return params.toString();
}
