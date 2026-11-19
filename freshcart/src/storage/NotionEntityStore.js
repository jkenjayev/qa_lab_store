import { parseRow, rowProperties } from './rows.js';

/**
 * One Notion database as a keyed collection of JSON records.
 * Reads happen once (load); every change goes through the shared write queue.
 */
export class NotionEntityStore {
  #pageIds = new Map();
  #loaded = new Map();

  constructor({ gateway, queue, dataSourceId, title, warn = () => {} }) {
    this.gateway = gateway;
    this.queue = queue;
    this.dataSourceId = dataSourceId;
    this.title = title;
    this.warn = warn;
  }

  /** Read every row. Rows with a missing key or broken JSON are skipped with a warning. */
  async load() {
    this.#pageIds.clear();
    this.#loaded.clear();
    const records = [];
    for (const page of await this.gateway.queryRows(this.dataSourceId)) {
      const row = parseRow(page);
      if (!row) {
        this.warn(`${this.title}: skipped an unreadable row (${page?.id})`);
        continue;
      }
      this.#pageIds.set(row.key, row.pageId);
      this.#loaded.set(row.key, JSON.stringify(row.data));
      records.push({ key: row.key, data: row.data });
    }
    return records;
  }

  /** Create or update the row of a key. Resolves when written (or given up). */
  upsert(key, data, summary = '') {
    return this.queue.enqueue(`${this.title}/${key}`, async () => {
      const properties = rowProperties(key, summary, data);
      const pageId = this.#pageIds.get(key);
      if (pageId) {
        await this.gateway.updateRow(pageId, properties);
      } else {
        const created = await this.gateway.createRow(this.dataSourceId, properties);
        this.#pageIds.set(key, created.id);
      }
      this.#loaded.set(key, JSON.stringify(data));
    });
  }

  /** Archive the row of a key (no-op when it has none). */
  archive(key) {
    return this.queue.enqueue(`${this.title}/${key}`, async () => {
      const pageId = this.#pageIds.get(key);
      if (!pageId) return;
      await this.gateway.archiveRow(pageId);
      this.#pageIds.delete(key);
      this.#loaded.delete(key);
    });
  }

  /**
   * Make the database match entities [{ key, data, summary }]: write what is new or changed (identical rows
   * cause no call), and with prune archive rows that are not in the list. Call after load().
   */
  async sync(entities, { prune = false } = {}) {
    const wanted = new Set(entities.map((e) => e.key));
    const jobs = [];
    let written = 0;
    for (const e of entities) {
      if (this.#loaded.get(e.key) === JSON.stringify(e.data)) continue;
      written += 1;
      jobs.push(this.upsert(e.key, e.data, e.summary));
    }
    let archived = 0;
    if (prune) {
      for (const key of [...this.#pageIds.keys()]) {
        if (wanted.has(key)) continue;
        archived += 1;
        jobs.push(this.archive(key));
      }
    }
    await Promise.all(jobs);
    return { written, archived };
  }

  keys() {
    return [...this.#pageIds.keys()];
  }
}
