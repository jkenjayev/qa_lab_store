/**
 * Write-through cache over Notion. Rows are loaded once at startup; afterwards every change is
 * compared with what Notion already holds and only differences are queued as writes.
 * Gateway contract (see SdkNotionGateway):
 *   resolveCollections(parentPageId, titles) -> { title: dataSourceId }
 *   listRows(dataSourceId)                   -> [{ pageId, key, data }]
 *   createRow(dataSourceId, { key, summary, data }) -> pageId
 *   updateRow(pageId, { summary, data })
 *   archiveRow(pageId)
 */
export class NotionStore {
  constructor({ gateway, queue, collections, parentPageId, ctx, log = () => {} }) {
    Object.assign(this, { gateway, queue, collections, parentPageId, ctx, log });
    this.byName = new Map(collections.map((c) => [c.name, c]));
    this.index = new Map(collections.map((c) => [c.name, new Map()]));
    this.sources = {};
  }

  /** Finds the databases and reads every row. Returns { collectionName: [entity] }. */
  async loadAll() {
    const titles = this.collections.map((c) => c.title);
    this.sources = await this.queue.enqueue('find databases', () => this.gateway.resolveCollections(this.parentPageId, titles));
    const snapshot = {};
    for (const c of this.collections) {
      const rows = await this.queue.enqueue(`load ${c.title}`, () => this.gateway.listRows(this.sources[c.title]));
      const index = new Map();
      const entities = [];
      for (const row of rows) {
        try {
          entities.push(c.deserialize(JSON.parse(row.data), this.ctx));
          index.set(row.key, { pageId: row.pageId, data: row.data });
        } catch (error) {
          this.log(`Skipping unreadable row ${row.key} in ${c.title}: ${error.message}`);
        }
      }
      this.index.set(c.name, index);
      snapshot[c.name] = entities;
    }
    return snapshot;
  }

  #fire(label, task) {
    return this.queue.enqueue(label, task).then(
      () => true,
      (error) => {
        this.log(`Notion write failed (${label}): ${error.message}`);
        return false;
      },
    );
  }

  /** Creates or updates the row of an entity. Resolves to true when written (or already up to date). */
  upsert(name, entity) {
    const c = this.byName.get(name);
    const key = c.key(entity);
    const data = JSON.stringify(c.serialize(entity, this.ctx));
    const summary = c.summary(entity);
    const index = this.index.get(name);
    const existing = index.get(key);
    if (existing && existing.data === data) return Promise.resolve(true);

    if (existing) {
      existing.data = data;
      return this.#fire(`update ${c.title} ${key}`, async () => {
        if (!existing.pageId) throw new Error('row was never created');
        await this.gateway.updateRow(existing.pageId, { summary, data });
      });
    }
    const entry = { pageId: null, data };
    index.set(key, entry);
    return this.#fire(`create ${c.title} ${key}`, async () => {
      try {
        entry.pageId = await this.gateway.createRow(this.sources[c.title], { key, summary, data });
      } catch (error) {
        if (index.get(key) === entry) index.delete(key); // lets the next upsert retry the create
        throw error;
      }
    });
  }

  /** Moves the row of a removed entity to the Notion trash. */
  remove(name, key) {
    const c = this.byName.get(name);
    const index = this.index.get(name);
    const entry = index.get(key);
    if (!entry) return Promise.resolve(true);
    index.delete(key);
    return this.#fire(`archive ${c.title} ${key}`, async () => {
      if (!entry.pageId) throw new Error('row was never created');
      await this.gateway.archiveRow(entry.pageId);
    });
  }

  /** Makes Notion match a snapshot: upsert everything in it, archive rows that are not in it. */
  replaceAll(snapshot, { archiveExtras = true } = {}) {
    const jobs = [];
    for (const c of this.collections) {
      const entities = snapshot[c.name] ?? [];
      const keep = new Set(entities.map((e) => c.key(e)));
      for (const e of entities) jobs.push(this.upsert(c.name, e));
      if (archiveExtras) {
        for (const key of [...this.index.get(c.name).keys()]) if (!keep.has(key)) jobs.push(this.remove(c.name, key));
      }
    }
    return Promise.all(jobs);
  }

  flush() {
    return this.queue.idle();
  }

  status() {
    return { mode: 'notion', pending: this.queue.pending, lastError: this.queue.lastError, lastSyncAt: this.queue.lastSyncAt };
  }
}
