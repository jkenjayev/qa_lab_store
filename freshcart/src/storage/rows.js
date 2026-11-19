import { fromRichText, toRichText } from './chunk.js';

const SUMMARY_MAX = 1900;

/** Notion property payload for one record: Key (title), Summary (readable), Data (JSON, chunked). */
export function rowProperties(key, summary, data) {
  return {
    Key: { title: [{ type: 'text', text: { content: String(key) } }] },
    Summary: { rich_text: toRichText(String(summary ?? '').slice(0, SUMMARY_MAX)) },
    Data: { rich_text: toRichText(JSON.stringify(data)) },
  };
}

/**
 * Read a Notion page back into a record. Data is the single source of truth.
 * Returns null when the row has no key or its Data is not valid JSON.
 */
export function parseRow(page) {
  const props = page?.properties ?? {};
  const key = fromRichText(props.Key?.title);
  if (!key) return null;
  try {
    return { key, pageId: page.id, data: JSON.parse(fromRichText(props.Data?.rich_text)) };
  } catch {
    return null;
  }
}
