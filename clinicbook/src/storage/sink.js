/** A sink receives every change (upsert, remove) and the full-reset snapshot. This one ignores them (memory mode). */
export const NOOP_SINK = Object.freeze({
  upsert() {},
  remove() {},
  replaceAll() {},
});
