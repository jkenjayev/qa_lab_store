import { createHash } from 'node:crypto';

/** Shared helpers to write Postman collections (schema v2.1.0) as plain data. Used by every app's builder. */
export const SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

/** Stable UUID derived from a name, so regenerating the files gives identical ids. */
export function stableId(name) {
  const h = createHash('sha1').update(name).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const lines = (text) => String(text).split('\n');

/**
 * The checks every request gets. Each check is one line so the runner (and a reader) can see it.
 *   status: 200 or [200, 400]   json: 'object' | 'array' | false   contentType: 'text/csv'
 *   fields: { 'name': 'string' }                  top-level fields of the body
 *   itemFields: { 'id': 'string' }                fields of the first element of an array body
 *   nested: { user: { id: 'string' } }            fields of a nested object
 *   at: { '.rows[0]': { id: 'string' } }          fields at any path of the body
 *   save: { variableName: 'path.in.body' }        store a value for later requests
 */
export function testScript({ status = 200, json = 'object', contentType, fields = {}, itemFields = {}, nested = {}, at = {}, save = {} } = {}) {
  const out = [];
  if (Array.isArray(status)) {
    out.push(`pm.test("Status is one of ${status.join(', ')}", function () { pm.expect(pm.response.code).to.be.oneOf([${status.join(', ')}]); });`);
  } else {
    out.push(`pm.test("Status is ${status}", function () { pm.response.to.have.status(${status}); });`);
  }
  if (json) {
    out.push('pm.test("Response is JSON", function () { pm.expect(pm.response.headers.get("Content-Type")).to.include("application/json"); });');
    out.push(`pm.test("Body is ${json === 'array' ? 'an array' : 'an object'}", function () { pm.expect(pm.response.json()).to.be.an("${json}"); });`);
  }
  if (contentType) {
    out.push(`pm.test("Content-Type is ${contentType}", function () { pm.expect(pm.response.headers.get("Content-Type")).to.include("${contentType}"); });`);
  }
  const field = (path, name, type) =>
    out.push(`pm.test("${path || 'Body'} has ${name}${type ? ` (${type})` : ''}", function () { pm.expect(pm.response.json()${path}).to.have.property("${name}")${type ? `.that.is.a("${type}")` : ''}; });`);
  for (const [name, type] of Object.entries(fields)) field('', name, type);
  for (const [name, type] of Object.entries(itemFields)) field('[0]', name, type);
  for (const [parent, props] of Object.entries(nested)) for (const [name, type] of Object.entries(props)) field(`.${parent}`, name, type);
  for (const [path, props] of Object.entries(at)) for (const [name, type] of Object.entries(props)) field(path, name, type);
  for (const [variable, path] of Object.entries(save)) {
    out.push(`pm.collectionVariables.set("${variable}", pm.response.json()${path.startsWith('[') ? '' : '.'}${path});`);
  }
  return out;
}

/** A request item. `path` may contain {{variables}}; `query` is an object. */
export function request({ name, method = 'GET', path, query = {}, body, description = '', tests = {}, extraTest = [], prerequest = [], headers = [] }) {
  const queryEntries = Object.entries(query);
  const queryString = queryEntries.length ? `?${queryEntries.map(([k, v]) => `${k}=${v}`).join('&')}` : '';
  const segments = path.split('/').filter(Boolean);
  const hasBody = body !== undefined;
  const allHeaders = [...headers];
  if (hasBody) allHeaders.push({ key: 'Content-Type', value: 'application/json' });
  const event = [{ listen: 'test', script: { type: 'text/javascript', exec: [...testScript(tests), ...extraTest] } }];
  if (prerequest.length) event.unshift({ listen: 'prerequest', script: { type: 'text/javascript', exec: prerequest } });
  return {
    name,
    event,
    request: {
      method,
      header: allHeaders,
      ...(hasBody ? { body: { mode: 'raw', raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } } : {}),
      url: {
        raw: `{{baseUrl}}/${segments.join('/')}${queryString}`,
        host: ['{{baseUrl}}'],
        path: segments,
        ...(queryEntries.length ? { query: queryEntries.map(([key, value]) => ({ key, value: String(value) })) } : {}),
      },
      description: lines(description).join('\n'),
    },
    response: [],
  };
}

export const folder = (name, description, item) => ({ name, description, item });

export function collection({ name, description, items, variables, schema = SCHEMA }) {
  return {
    info: { _postman_id: stableId(`collection:${name}`), name, description, schema },
    item: items,
    variable: variables.map(({ key, value, description: d }) => ({ key, value, type: 'string', ...(d ? { description: d } : {}) })),
  };
}

export function environment({ name, values }) {
  return {
    id: stableId(`environment:${name}`),
    name,
    values: values.map(({ key, value, type = 'default' }) => ({ key, value, type, enabled: true })),
    _postman_variable_scope: 'environment',
    _postman_exported_at: '2026-11-19T00:00:00.000Z',
    _postman_exported_using: 'qa-lab-apps generator',
  };
}

/** Flat list of { folder, item } for every request in a collection (nested folders joined with " / "). */
export function flattenRequests(items, prefix = []) {
  const out = [];
  for (const entry of items) {
    if (entry.item) out.push(...flattenRequests(entry.item, [...prefix, entry.name]));
    else out.push({ folder: prefix.join(' / '), item: entry });
  }
  return out;
}

/** Checks the structure Postman needs to import a v2.1.0 collection. Returns a list of problems (empty when valid). */
export function validateCollection(c) {
  const problems = [];
  if (c?.info?.schema !== SCHEMA) problems.push('info.schema is not collection v2.1.0');
  if (!c?.info?.name) problems.push('info.name is missing');
  if (!/^[0-9a-f-]{36}$/.test(c?.info?._postman_id ?? '')) problems.push('info._postman_id is not a UUID');
  if (!Array.isArray(c?.item) || c.item.length === 0) problems.push('item must be a non-empty array');
  const walk = (items, where) => {
    const names = new Set();
    for (const entry of items ?? []) {
      const label = `${where}/${entry.name}`;
      if (!entry.name) problems.push(`${where}: an item has no name`);
      if (names.has(entry.name)) problems.push(`${label}: duplicate name`);
      names.add(entry.name);
      if (entry.item) {
        if (!Array.isArray(entry.item) || entry.item.length === 0) problems.push(`${label}: folder is empty`);
        else walk(entry.item, label);
        continue;
      }
      const r = entry.request;
      if (!r?.method) problems.push(`${label}: request.method missing`);
      const u = r?.url;
      if (!u || typeof u.raw !== 'string' || !Array.isArray(u.host) || !Array.isArray(u.path)) problems.push(`${label}: request.url must have raw, host[] and path[]`);
      if (!Array.isArray(r?.header)) problems.push(`${label}: request.header must be an array`);
      if (r?.body && !(r.body.mode === 'raw' && typeof r.body.raw === 'string')) problems.push(`${label}: body must be raw`);
      const tests = (entry.event ?? []).filter((e) => e.listen === 'test');
      if (tests.length !== 1 || !Array.isArray(tests[0].script?.exec) || tests[0].script.exec.length === 0) problems.push(`${label}: needs one test script`);
      if (!Array.isArray(entry.response)) problems.push(`${label}: response must be an array`);
    }
  };
  walk(c?.item, c?.info?.name ?? '');
  return problems;
}
