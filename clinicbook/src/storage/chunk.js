/** Notion rich text items hold at most 2000 characters, and a property at most 100 items. */
export const MAX_CHUNK = 2000;
export const MAX_ITEMS = 100;

/** Splits text into chunks that fit Notion rich text items. */
export function chunkText(text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_CHUNK) chunks.push(text.slice(i, i + MAX_CHUNK));
  if (chunks.length > MAX_ITEMS) {
    throw new RangeError(`Record is too large for one Notion property (${text.length} characters, limit ${MAX_CHUNK * MAX_ITEMS})`);
  }
  return chunks;
}

/** Inverse of chunkText. */
export function joinChunks(chunks) {
  return chunks.join('');
}
