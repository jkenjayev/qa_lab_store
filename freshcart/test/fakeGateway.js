import { DB_TITLES, } from '../src/storage/records.js';
import { parseRow, rowProperties } from '../src/storage/rows.js';

/** Notion answers carry plain_text next to text.content; mimic that so reads go through the real parsing path. */
function asResponse(properties) {
  const out = {};
  for (const [name, prop] of Object.entries(properties)) {
    const field = prop.title ? 'title' : 'rich_text';
    out[name] = { [field]: prop[field].map((i) => ({ ...i, plain_text: i.text.content })) };
  }
  return out;
}

/** In-memory stand-in for the Notion gateway: same small interface, plus call log and failure injection. */
export class FakeNotionGateway {
  constructor({ titles = Object.values(DB_TITLES) } = {}) {
    this.sources = new Map(titles.map((t, i) => [t, `ds-${i + 1}`]));
    this.rows = new Map([...this.sources.values()].map((id) => [id, new Map()]));
    this.calls = [];
    this.failures = [];
    this.nextId = 1;
  }

  /** Fail the next `count` calls to `method` with `error` (a plain object becomes an Error with those fields). */
  failNext(method, count, error) {
    this.failures.push({ method, count, error });
  }

  #enter(method, args) {
    this.calls.push({ method, ...args });
    const f = this.failures.find((x) => x.method === method && x.count > 0);
    if (f) {
      f.count -= 1;
      throw Object.assign(new Error(f.error.message ?? 'injected failure'), f.error);
    }
  }

  writes() {
    return this.calls.filter((c) => ['createRow', 'updateRow', 'archiveRow'].includes(c.method));
  }

  async resolveDataSource(parentPageId, title) {
    this.#enter('resolveDataSource', { parentPageId, title });
    if (!this.sources.has(title)) throw new Error(`Database "${title}" was not found on Notion page ${parentPageId}.`);
    return this.sources.get(title);
  }

  async queryRows(dataSourceId) {
    this.#enter('queryRows', { dataSourceId });
    return [...this.rows.get(dataSourceId).values()].map((r) => ({ id: r.id, properties: r.properties }));
  }

  async createRow(dataSourceId, properties) {
    this.#enter('createRow', { dataSourceId, properties });
    const id = `page-${this.nextId++}`;
    this.rows.get(dataSourceId).set(id, { id, properties: asResponse(properties) });
    return { id };
  }

  async updateRow(pageId, properties) {
    this.#enter('updateRow', { pageId, properties });
    for (const table of this.rows.values()) if (table.has(pageId)) table.get(pageId).properties = asResponse(properties);
  }

  async archiveRow(pageId) {
    this.#enter('archiveRow', { pageId });
    for (const table of this.rows.values()) table.delete(pageId);
  }

  /** Test helpers to look at and edit stored rows by database title. */
  table(title) {
    return [...this.rows.get(this.sources.get(title)).values()]
      .map((r) => parseRow(r))
      .filter(Boolean);
  }

  editRow(title, key, mutate) {
    const table = this.rows.get(this.sources.get(title));
    for (const row of table.values()) {
      const parsed = parseRow(row);
      if (parsed?.key === key) row.properties = asResponse(rowProperties(key, '', mutate(parsed.data)));
    }
  }

  /** Add a stored record directly, as if an earlier run had written it. */
  putRecord(title, pageId, key, data) {
    this.putRaw(title, pageId, asResponse(rowProperties(key, '', data)));
  }

  putRaw(title, id, properties) {
    this.rows.get(this.sources.get(title)).set(id, { id, properties });
  }
}
