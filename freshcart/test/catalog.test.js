import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORIES, PRODUCTS } from '../src/data/products.js';
import { categoryCounts, listProducts, nameMatches, normalizeQuery, suggest } from '../src/domain/catalog.js';
import { ValidationError } from '../src/domain/errors.js';
import { OFF, ON } from './helpers.js';

const list = (query, defects) => listProducts(PRODUCTS, query, { defects });
const names = (r) => r.items.map((p) => p.name);

describe('seed data', () => {
  it('has 48 products with unique ids and the 8 categories with the Notion counts', () => {
    assert.equal(PRODUCTS.length, 48);
    assert.equal(new Set(PRODUCTS.map((p) => p.id)).size, 48);
    const counts = Object.fromEntries(categoryCounts(PRODUCTS, CATEGORIES).map((c) => [c.slug, c.count]));
    assert.deepEqual(counts, { dairy: 9, bakery: 7, fruit: 12, vegetables: 6, meat: 5, drinks: 4, snacks: 3, household: 2 });
  });

  it('contains the named test products with their prices and stock', () => {
    const by = (name) => PRODUCTS.find((p) => p.name === name);
    assert.equal(by('Sut, to\'liq yog\'li 1 l').id, 12);
    assert.equal(by('Sut, to\'liq yog\'li 1 l').priceCents, 120);
    assert.equal(by('Sut, to\'liq yog\'li 1 l').imageCount, 4);
    assert.equal(by('Sut, to\'liq yog\'li 1 l').stock, 0);
    assert.equal(by('Yunon yogurti').priceCents, 350);
    assert.equal(by('Yunon yogurti').stock, 3);
    assert.equal(by('Banan 1 kg').priceCents, 200);
    assert.equal(by('Jigarrang tuxum').priceCents, 450);
    assert.equal(by('Jigarrang tuxum').stock, 6);
    assert.equal(by('Pishloq bo\'lagi').priceCents, 1400);
    assert.equal(by('Petrushka bog\'i').priceCents, 80);
    assert.ok(PRODUCTS.some((p) => p.name.startsWith('Kichik oilaviy xo\'jaliklarda') && p.priceCents === 2100));
    assert.ok(PRODUCTS.some((p) => p.priceCents === 1000));
    assert.ok(PRODUCTS.some((p) => p.priceCents === 999));
    assert.ok(PRODUCTS.some((p) => p.priceCents === 1999));
  });
});

describe('normalizeQuery', () => {
  it('cleans page, sort, filters and the search term', () => {
    assert.deepEqual(normalizeQuery({}), { page: 1, sort: 'name-asc', category: undefined, min: undefined, max: undefined, q: '' });
    const q = normalizeQuery({ page: '3', sort: 'price-desc', category: 'dairy', min: '2', max: '5000', q: '  sut ' });
    assert.deepEqual(q, { page: 3, sort: 'price-desc', category: 'dairy', min: 2, max: 999, q: 'sut' });
    assert.equal(normalizeQuery({ page: '-4', sort: 'bogus', min: 'x' }).page, 1);
    assert.equal(normalizeQuery({ sort: 'bogus' }).sort, 'name-asc');
    assert.equal(normalizeQuery({ min: '-1' }).min, undefined);
  });
});

describe('F1.1 listing', () => {
  it('FC_PAGE_SIZE_10 on: 10 products per page, 5 pages', () => {
    const r = list({}, ON);
    assert.equal(r.items.length, 10);
    assert.equal(r.total, 48);
    assert.equal(r.pageCount, 5);
    assert.equal(list({ page: 5 }, ON).items.length, 8);
  });

  it('FC_PAGE_SIZE_10 off: 12 products per page, 4 pages', () => {
    const r = list({}, OFF);
    assert.equal(r.items.length, 12);
    assert.equal(r.pageCount, 4);
    assert.equal(r.pageSize, 12);
  });

  it('default sort is Name A-Z and the first row has the Notion prices', () => {
    const first4 = list({}, ON).items.slice(0, 4);
    assert.deepEqual(first4.map((p) => p.priceCents), [340, 270, 290, 350]);
    assert.deepEqual(first4.map((p) => p.name), ['Ananas', 'Apelsin 1 kg', 'Apelsin sharbati 1 l', 'Avokado, 4 dona']);
  });

  it('price low to high puts the cheapest first', () => {
    const r = list({ sort: 'price-asc' }, OFF);
    assert.equal(r.items[0].name, 'Petrushka bog\'i');
    assert.equal(r.items[1].priceCents, 120);
  });

  it('FC_SORT_PRICE_DESC_ASC on: high to low starts with the cheapest products', () => {
    const r = list({ sort: 'price-desc' }, ON);
    assert.equal(r.items[0].name, 'Petrushka bog\'i');
  });

  it('FC_SORT_PRICE_DESC_ASC off: high to low starts with the most expensive product', () => {
    const r = list({ sort: 'price-desc' }, OFF);
    assert.ok(r.items[0].name.startsWith('Kichik oilaviy xo\'jaliklarda'));
    assert.ok(r.items[0].priceCents >= r.items[1].priceCents);
  });

  it('a page beyond the last is empty', () => {
    const r = list({ page: 99 }, ON);
    assert.deepEqual(r.items, []);
    assert.equal(r.total, 48);
  });
});

describe('F1.3 filters', () => {
  it('filters by category', () => {
    assert.equal(list({ category: 'dairy' }, ON).total, 9);
    assert.equal(list({ category: 'household' }, OFF).total, 2);
  });

  it('FC_PRICE_MAX_EXCLUSIVE on: a product priced exactly at Max is dropped', () => {
    const r = list({ min: '2', max: '10', sort: 'price-asc', page: 1 }, ON);
    const all = PRODUCTS.filter((p) => p.priceCents >= 200 && p.priceCents < 1000);
    assert.equal(r.total, all.length);
    assert.ok(!r.items.some((p) => p.priceCents === 1000));
    assert.ok(r.items.some((p) => p.priceCents === 200), 'Min is inclusive');
    assert.equal(list({ min: '2', max: '10', sort: 'price-desc' }, ON).items.at(0).priceCents <= 999, true);
  });

  it('FC_PRICE_MAX_EXCLUSIVE off: Max is inclusive', () => {
    const r = list({ min: '2', max: '10' }, OFF);
    assert.equal(r.total, PRODUCTS.filter((p) => p.priceCents >= 200 && p.priceCents <= 1000).length);
  });

  it('FC_PRICE_MIN_GT_MAX_NO_ERROR on: Min above Max just gives an empty list', () => {
    const r = list({ min: '12', max: '5' }, ON);
    assert.equal(r.total, 0);
    assert.deepEqual(r.items, []);
  });

  it('FC_PRICE_MIN_GT_MAX_NO_ERROR off: Min above Max is a validation error', () => {
    assert.throws(
      () => list({ min: '12', max: '5' }, OFF),
      (e) => e instanceof ValidationError && e.message === 'Minimal narx maksimal narxdan oshmasligi kerak',
    );
  });
});

describe('F1.2 search and suggestions', () => {
  it('FC_SEARCH_CASE_SENSITIVE on: Sut finds 4 products, sut finds none', () => {
    assert.equal(list({ q: 'Sut' }, ON).total, 4);
    assert.equal(list({ q: 'sut' }, ON).total, 0);
    assert.equal(nameMatches('Sut, to\'liq yog\'li 1 l', 'sut', ON), false);
  });

  it('FC_SEARCH_CASE_SENSITIVE off: sut finds the same 4 products as Sut', () => {
    assert.equal(list({ q: 'sut' }, OFF).total, 4);
    assert.deepEqual(names(list({ q: 'sut' }, OFF)).sort(), names(list({ q: 'Sut' }, OFF)).sort());
    assert.equal(nameMatches('Sut, to\'liq yog\'li 1 l', 'sut', OFF), true);
  });

  it('FC_SUGGEST_ONE_CHAR on: one character gives 5 suggestions', () => {
    assert.equal(suggest(PRODUCTS, 'a', ON).length, 5);
  });

  it('FC_SUGGEST_ONE_CHAR off: one character gives no suggestions, two do', () => {
    assert.deepEqual(suggest(PRODUCTS, 'a', OFF), []);
    const two = suggest(PRODUCTS, 'ol', OFF);
    assert.ok(two.length > 0 && two.length <= 5);
  });

  it('suggestions for Sut are the four Sut products in name order', () => {
    assert.deepEqual(
      suggest(PRODUCTS, 'Sut', ON).map((s) => s.name),
      ['Sut, jo\'xori 1 l', 'Sut, soya 1 l', 'Sut, to\'liq yog\'li 1 l', 'Sut, yog\'sizlantirilgan 1 l'],
    );
  });
});
