/** Notion rich text: one item holds at most 2000 characters and a property at most 100 items. */
export const CHUNK_SIZE = 2000;
export const MAX_ITEMS = 100;

/** Split text into pieces of at most CHUNK_SIZE characters, never inside a surrogate pair. */
export function chunkText(text) {
  const chunks = [];
  let rest = String(text ?? '');
  while (rest.length > CHUNK_SIZE) {
    let cut = CHUNK_SIZE;
    const code = rest.charCodeAt(cut - 1);
    if (code >= 0xd800 && code <= 0xdbff) cut -= 1; // do not split a surrogate pair
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.length) chunks.push(rest);
  if (chunks.length > MAX_ITEMS) {
    throw new RangeError(`Record is too large for one Notion property (${chunks.length} chunks, max ${MAX_ITEMS})`);
  }
  return chunks;
}

/** Notion rich_text array for a request. Empty text gives an empty array. */
export function toRichText(text) {
  return chunkText(text).map((content) => ({ type: 'text', text: { content } }));
}

/** Plain text of a rich_text array from a response (or a request-shaped array). */
export function fromRichText(items) {
  if (!Array.isArray(items)) return '';
  return items.map((item) => item.plain_text ?? item.text?.content ?? '').join('');
}
