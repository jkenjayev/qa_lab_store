import { chunkText, joinChunks } from '../src/storage/chunk.js';

/**
 * In-memory stand-in for SdkNotionGateway. Rows go through chunking like the real adapter, so tests
 * also prove that long records survive a round trip. `failures` makes the next N calls of a method throw.
 */
export class FakeNotionGateway {
  constructor({ titles = [], missing = [] } = {}) {
    this.titles = titles.filter((t) => !missing.includes(t));
    this.pages = new Map(); // pageId -> { source, key, summary, chunks, trashed }
    this.calls = [];
    this.failures = {};
    this.nextId = 1;
  }

  #maybeFail(method) {
    this.calls.push(method);
    const left = this.failures[method];
    if (left?.count > 0) {
      left.count -= 1;
      throw Object.assign(new Error(left.message ?? 'boom'), { status: left.status });
    }
  }

  async resolveCollections(_parent, titles) {
    this.#maybeFail('resolveCollections');
    const missing = titles.filter((t) => !this.titles.includes(t));
    if (missing.length > 0) throw new Error(`Notion database(s) not found: ${missing.join(', ')}`);
    return Object.fromEntries(titles.map((t) => [t, `ds:${t}`]));
  }

  async listRows(source) {
    this.#maybeFail('listRows');
    return [...this.pages].filter(([, p]) => p.source === source && !p.trashed).map(([pageId, p]) => ({ pageId, key: p.key, data: joinChunks(p.chunks) }));
  }

  async createRow(source, { key, summary, data }) {
    this.#maybeFail('createRow');
    const pageId = `page-${this.nextId++}`;
    this.pages.set(pageId, { source, key, summary, chunks: chunkText(data), trashed: false });
    return pageId;
  }

  async updateRow(pageId, { summary, data }) {
    this.#maybeFail('updateRow');
    Object.assign(this.pages.get(pageId), { summary, chunks: chunkText(data) });
  }

  async archiveRow(pageId) {
    this.#maybeFail('archiveRow');
    this.pages.get(pageId).trashed = true;
  }

  /** Test helper: live rows of one database as { key: parsed Data }. */
  rows(title) {
    const out = {};
    for (const p of this.pages.values()) if (p.source === `ds:${title}` && !p.trashed) out[p.key] = JSON.parse(joinChunks(p.chunks));
    return out;
  }
}

export const ALL_TITLES = ['CB Doctors', 'CB Schedules', 'CB Appointments', 'CB Patients', 'CB Staff', 'CB Emails'];
