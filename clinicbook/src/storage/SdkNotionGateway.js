import { Client } from '@notionhq/client';
import { chunkText, joinChunks } from './chunk.js';

const text = (items) => (items ?? []).map((i) => i.plain_text ?? '').join('');

/**
 * The only file that talks to the Notion SDK (API version 2025-09-03: a database has data
 * sources, rows are queried through the data source). Every row has the columns Key (title),
 * Summary and Data (rich text; Data is the record as JSON, split into chunks).
 */
export class SdkNotionGateway {
  constructor(token, client) {
    this.client = client ?? new Client({ auth: token });
  }

  async #all(fetchPage) {
    const results = [];
    let cursor;
    do {
      const response = await fetchPage(cursor);
      results.push(...response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
    return results;
  }

  /** Looks up the child databases of the parent page by title and returns their data source ids. */
  async resolveCollections(parentPageId, titles) {
    const blocks = await this.#all((cursor) => this.client.blocks.children.list({ block_id: parentPageId, start_cursor: cursor, page_size: 100 }));
    const databases = new Map();
    for (const block of blocks) {
      if (block.type === 'child_database') databases.set(block.child_database.title, block.id);
    }
    const missing = titles.filter((t) => !databases.has(t));
    if (missing.length > 0) {
      throw new Error(`Notion database(s) not found under page ${parentPageId}: ${missing.join(', ')}. Share the page with your integration and check the names.`);
    }
    const sources = {};
    for (const title of titles) {
      const database = await this.client.databases.retrieve({ database_id: databases.get(title) });
      const source = database.data_sources?.[0];
      if (!source) throw new Error(`Notion database ${title} has no data source`);
      sources[title] = source.id;
    }
    return sources;
  }

  async listRows(dataSourceId) {
    const pages = await this.#all((cursor) => this.client.dataSources.query({ data_source_id: dataSourceId, start_cursor: cursor, page_size: 100 }));
    return pages
      .filter((page) => page.properties && !page.in_trash)
      .map((page) => ({
        pageId: page.id,
        key: text(page.properties.Key?.title),
        data: joinChunks((page.properties.Data?.rich_text ?? []).map((i) => i.plain_text ?? '')),
      }));
  }

  #properties({ key, summary, data }) {
    const properties = {};
    if (key !== undefined) properties.Key = { title: [{ text: { content: key } }] };
    if (summary !== undefined) properties.Summary = { rich_text: [{ text: { content: summary.slice(0, 2000) } }] };
    if (data !== undefined) properties.Data = { rich_text: chunkText(data).map((content) => ({ text: { content } })) };
    return properties;
  }

  async createRow(dataSourceId, row) {
    const page = await this.client.pages.create({
      parent: { type: 'data_source_id', data_source_id: dataSourceId },
      properties: this.#properties(row),
    });
    return page.id;
  }

  async updateRow(pageId, { summary, data }) {
    await this.client.pages.update({ page_id: pageId, properties: this.#properties({ summary, data }) });
  }

  async archiveRow(pageId) {
    await this.client.pages.update({ page_id: pageId, in_trash: true });
  }
}
