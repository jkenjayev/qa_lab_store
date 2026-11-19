import { ValidationError } from './errors.js';

export const SORTS = Object.freeze(['name-asc', 'price-asc', 'price-desc']);

/** Cleans the raw query string values of the listing endpoint. */
export function normalizeQuery(raw = {}) {
  const page = Number.parseInt(raw.page, 10);
  const whole = (v) => (/^\d+$/.test(String(v ?? '')) ? Math.min(Number(v), 999) : undefined);
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    sort: SORTS.includes(raw.sort) ? raw.sort : 'name-asc',
    category: raw.category ? String(raw.category) : undefined,
    min: whole(raw.min),
    max: whole(raw.max),
    q: String(raw.q ?? '').trim(),
  };
}

/** Name matching used by search and suggestions. */
export function nameMatches(name, term, defects) {
  // FC_SEARCH_CASE_SENSITIVE: "Search is case-sensitive"
  if (defects.FC_SEARCH_CASE_SENSITIVE) return name.includes(term);
  return name.toLowerCase().includes(term.toLowerCase());
}

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

function sorter(sort, defects) {
  // FC_SORT_PRICE_DESC_ASC: "Price high to low sorts ascending" - same comparator as low to high.
  const effective = sort === 'price-desc' && defects.FC_SORT_PRICE_DESC_ASC ? 'price-asc' : sort;
  if (effective === 'price-asc') return (a, b) => a.priceCents - b.priceCents || byName(a, b);
  if (effective === 'price-desc') return (a, b) => b.priceCents - a.priceCents || byName(a, b);
  return byName;
}

/** One page of products after search, category and price filters and sorting. */
export function listProducts(products, rawQuery, { defects }) {
  const query = normalizeQuery(rawQuery);
  const { min, max } = query;
  // FC_PRICE_MIN_GT_MAX_NO_ERROR: "No error when Min is greater than Max" - the filter just yields nothing.
  if (min !== undefined && max !== undefined && min > max && !defects.FC_PRICE_MIN_GT_MAX_NO_ERROR) {
    throw new ValidationError('Minimal narx maksimal narxdan oshmasligi kerak');
  }

  const filtered = products.filter((p) => {
    if (query.category && p.category !== query.category) return false;
    if (query.q && !nameMatches(p.name, query.q, defects)) return false;
    if (min !== undefined && p.priceCents < min * 100) return false;
    if (max !== undefined) {
      // FC_PRICE_MAX_EXCLUSIVE: "Price Max is exclusive" - a product priced exactly at Max is dropped.
      const tooHigh = defects.FC_PRICE_MAX_EXCLUSIVE ? p.priceCents >= max * 100 : p.priceCents > max * 100;
      if (tooHigh) return false;
    }
    return true;
  });

  filtered.sort(sorter(query.sort, defects));
  // FC_PAGE_SIZE_10: "Only 10 products per page"
  const pageSize = defects.FC_PAGE_SIZE_10 ? 10 : 12;
  const pageCount = Math.ceil(filtered.length / pageSize);
  const start = (query.page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page: query.page,
    pageCount,
    pageSize,
  };
}

/** Up to 5 suggestions for the header search box. */
export function suggest(products, rawTerm, defects) {
  const term = String(rawTerm ?? '').trim();
  // FC_SUGGEST_ONE_CHAR: "Suggestions appear after 1 character"
  const minChars = defects.FC_SUGGEST_ONE_CHAR ? 1 : 2;
  if (term.length < minChars) return [];
  return products
    .filter((p) => nameMatches(p.name, term, defects))
    .sort(byName)
    .slice(0, 5)
    .map((p) => ({ id: p.id, name: p.name }));
}

export function categoryCounts(products, categories) {
  return categories.map((c) => ({
    ...c,
    count: products.filter((p) => p.category === c.slug).length,
  }));
}
