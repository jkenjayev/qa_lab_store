import { Client } from '@notionhq/client';

const TRASH_FROM = '2026-03-11';

/** Seconds in a Retry-After header (plain object or Headers) as milliseconds, or undefined. */
function retryAfterMs(headers) {
  const raw = typeof headers?.get === 'function' ? headers.get('retry-after') : headers?.['retry-after'];
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

/**
 * The only module that talks to the Notion SDK (v5, databases hold data sources).
 * Retry policy lives in the WriteQueue, so the SDK's own retries are switched off.
 */
export class SdkNotionGateway {
  constructor(token, client) {
    this.client = client ?? new Client({ auth: token, retry: false });
    this.version = client?.notionVersion ?? Client.defaultNotionVersion ?? '';
  }

  async #call(fn) {
    try {
      return await fn();
    } catch (error) {
      const ms = retryAfterMs(error?.headers);
      if (ms !== undefined && error && typeof error === 'object') error.retryAfterMs = ms;
      throw error;
    }
  }

  /** Data source id of the child database called `title` on the parent page. */
  async resolveDataSource(parentPageId, title) {
    let cursor;
    do {
      const page = await this.#call(() =>
        this.client.blocks.children.list({ block_id: parentPageId, start_cursor: cursor, page_size: 100 }),
      );
      const hit = page.results.find((b) => b.type === 'child_database' && b.child_database?.title === title);
      if (hit) {
        const db = await this.#call(() => this.client.databases.retrieve({ database_id: hit.id }));
        const source = db.data_sources?.[0];
        if (!source) throw new Error(`Database "${title}" has no data source`);
        return source.id;
      }
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
    throw new Error(
      `Database "${title}" was not found on Notion page ${parentPageId}. Share that page with your integration and check the title.`,
    );
  }

  async queryRows(dataSourceId) {
    const rows = [];
    let cursor;
    do {
      const res = await this.#call(() =>
        this.client.dataSources.query({ data_source_id: dataSourceId, start_cursor: cursor, page_size: 100 }),
      );
      for (const r of res.results) {
        if (r.object === 'page' && !r.in_trash && !r.archived) rows.push({ id: r.id, properties: r.properties });
      }
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);
    return rows;
  }

  async createRow(dataSourceId, properties) {
    const page = await this.#call(() =>
      this.client.pages.create({ parent: { type: 'data_source_id', data_source_id: dataSourceId }, properties }),
    );
    return { id: page.id };
  }

  async updateRow(pageId, properties) {
    await this.#call(() => this.client.pages.update({ page_id: pageId, properties }));
  }

  async archiveRow(pageId) {
    const flag = this.version >= TRASH_FROM ? { in_trash: true } : { archived: true };
    await this.#call(() => this.client.pages.update({ page_id: pageId, ...flag }));
  }
}
