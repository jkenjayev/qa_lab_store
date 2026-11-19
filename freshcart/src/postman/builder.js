import {
  SCHEMA,
  collection as kitCollection,
  environment as kitEnvironment,
  folder as kitFolder,
  request as kitRequest,
  validateCollection,
} from '../../../postman/tools/collection-kit.mjs';

/**
 * Adapter between this app's compact request definitions and the shared collection kit
 * (qa-lab-apps/postman/tools). The kit writes the one-line test checks the shared runner understands.
 */
export { SCHEMA, kitCollection as collection, kitEnvironment as environment, validateCollection };

/** { 'a': 'string', 'totals.x': 'number' } -> kit `fields` (top level) and `at` (nested) maps. */
export function shapeToKit(shape = {}) {
  const fields = {};
  const at = {};
  for (const [key, type] of Object.entries(shape)) {
    const dot = key.lastIndexOf('.');
    if (dot === -1) fields[key] = type;
    else (at[`.${key.slice(0, dot)}`] ??= {})[key.slice(dot + 1)] = type;
  }
  return { fields, at };
}

/**
 * One request item.
 * def: { name, method, path, query, body, cart, expect, json, contentType, shape, save, extraTest, description, ac }
 *   expect  200 or [200, 400]. Several statuses mean the answer depends on the rule under test, so no body checks.
 *   json    'object' (default) | 'array' | false.   save  { variable: 'path.in.body' }.
 *   cart    send the X-Cart-Id header from the collection variable cartId.
 *   ac      numbers of the acceptance criteria shown in the description.
 */
export function request(def, criteria = []) {
  const status = def.expect ?? 200;
  const statuses = [].concat(status);
  const json = def.json === undefined ? 'object' : def.json;
  const single = statuses.length === 1;
  const { fields, at } = shapeToKit(single ? def.shape : {});
  if (json === 'object' && statuses.every((s) => s >= 400)) fields.error = 'string';
  const ac = (def.ac ?? []).map((n) => `- AC${n}. ${criteria[n - 1]}`);
  const description = [def.description, ac.length ? `Qabul mezonlari:\n${ac.join('\n')}` : ''].filter(Boolean).join('\n\n');
  return kitRequest({
    name: def.name,
    method: def.method,
    path: def.path,
    query: def.query,
    body: def.body,
    headers: def.cart ? [{ key: 'X-Cart-Id', value: '{{cartId}}' }] : [],
    description,
    extraTest: def.extraTest,
    tests: { status, json, contentType: def.contentType, fields, at, save: single ? def.save : {} },
  });
}

/** A folder for one feature: the description lists all acceptance criteria. */
export function folder(title, criteria, requests, intro = '') {
  const list = criteria.map((c, i) => `AC${i + 1}. ${c}`).join('\n');
  const description = [intro, `Qabul mezonlari (Notion'dagi Feature sahifasidan):\n${list}`].filter(Boolean).join('\n\n');
  return kitFolder(title, description, requests.map((r) => request(r, criteria)));
}
