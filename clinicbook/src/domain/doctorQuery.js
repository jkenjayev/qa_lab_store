/** Filtering and sorting of the doctor directory. */
export function filterAndSortDoctors(doctors, { specialty, name, sort }, defects) {
  let result = doctors;
  if (specialty) result = result.filter((d) => d.specialty === specialty);
  const query = String(name ?? '').trim();
  if (query) {
    // CB_DOCTOR_SEARCH_CASE_SENSITIVE (Doctor name search is case-sensitive)
    result = defects.CB_DOCTOR_SEARCH_CASE_SENSITIVE
      ? result.filter((d) => d.name.includes(query))
      : result.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));
  }
  const sorted = [...result];
  if (sort === 'experience') {
    // CB_EXPERIENCE_SORT_ASCENDING (Experience sort is ascending)
    sorted.sort((a, b) => (defects.CB_EXPERIENCE_SORT_ASCENDING ? a.years - b.years : b.years - a.years));
  } else {
    sorted.sort((a, b) => a.nextAvailable.localeCompare(b.nextAvailable) || a.name.localeCompare(b.name));
  }
  return sorted;
}
