import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCHEMA, collection, environment, flattenRequests, folder, request, stableId, testScript, validateCollection } from '../tools/collection-kit.mjs';

test('stableId is a UUID that depends only on the name', () => {
  assert.match(stableId('a'), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(stableId('a'), stableId('a'));
  assert.notEqual(stableId('a'), stableId('b'));
});

test('testScript writes one line per check', () => {
  const lines = testScript({
    status: 201,
    fields: { id: 'string', ok: undefined },
    itemFields: { name: 'string' },
    nested: { user: { role: 'string' } },
    at: { '.rows[0]': { date: 'string' } },
    save: { ref: 'reference', first: '[0].id' },
  });
  assert.equal(lines[0], 'pm.test("Status is 201", function () { pm.response.to.have.status(201); });');
  assert.ok(lines.every((l) => !l.includes('\n')));
  assert.ok(lines.some((l) => l.includes('pm.response.json()).to.have.property("id").that.is.a("string")')));
  assert.ok(lines.some((l) => l.includes('to.have.property("ok"); }')));
  assert.ok(lines.some((l) => l.includes('pm.response.json()[0]).to.have.property("name")')));
  assert.ok(lines.some((l) => l.includes('pm.response.json().user).to.have.property("role")')));
  assert.ok(lines.some((l) => l.includes('pm.response.json().rows[0]')), 'paths keep their own dot');
  assert.ok(lines.includes('pm.collectionVariables.set("ref", pm.response.json().reference);'));
  assert.ok(lines.includes('pm.collectionVariables.set("first", pm.response.json()[0].id);'));
});

test('testScript supports several statuses, array bodies, no JSON and content types', () => {
  const several = testScript({ status: [200, 409], json: 'array', contentType: 'text/csv' });
  assert.match(several[0], /oneOf\(\[200, 409\]\)/);
  assert.ok(several.some((l) => l.includes('to.be.an("array")')));
  assert.ok(several.some((l) => l.includes('to.include("text/csv")')));
  assert.equal(testScript({ json: false }).length, 1);
  assert.equal(testScript().length, 3);
});

test('request builds a Postman v2.1 item with url parts, query, body and headers', () => {
  const item = request({ name: 'N', method: 'POST', path: '/api/x/{{id}}', query: { a: '1', b: 'two' }, body: { k: 'v' }, description: 'd', prerequest: ['pm.collectionVariables.set("x", "y" + Date.now() + "z");'], headers: [{ key: 'X-A', value: '1' }] });
  assert.equal(item.request.url.raw, '{{baseUrl}}/api/x/{{id}}?a=1&b=two');
  assert.deepEqual(item.request.url.path, ['api', 'x', '{{id}}']);
  assert.deepEqual(item.request.url.query, [{ key: 'a', value: '1' }, { key: 'b', value: 'two' }]);
  assert.deepEqual(item.request.header.map((h) => h.key), ['X-A', 'Content-Type']);
  assert.equal(item.request.body.mode, 'raw');
  assert.equal(JSON.parse(item.request.body.raw).k, 'v');
  assert.deepEqual(item.event.map((e) => e.listen), ['prerequest', 'test']);
  const plain = request({ name: 'P', path: '/health', body: '{"raw":true}' });
  assert.equal(plain.request.body.raw, '{"raw":true}');
  assert.equal(request({ name: 'Q', path: '/q' }).request.body, undefined);
  assert.equal(request({ name: 'Q', path: '/q' }).request.url.query, undefined);
});

test('collection and environment have the fields Postman needs', () => {
  const c = collection({ name: 'C', description: 'd', items: [folder('F', 'fd', [request({ name: 'R', path: '/r' })])], variables: [{ key: 'baseUrl', value: 'http://x', description: 'base' }, { key: 'v', value: '' }] });
  assert.equal(c.info.schema, SCHEMA);
  assert.deepEqual(c.variable.map((v) => v.key), ['baseUrl', 'v']);
  assert.equal(c.variable[0].description, 'base');
  assert.deepEqual(validateCollection(c), []);
  const e = environment({ name: 'E', values: [{ key: 'a', value: '1' }, { key: 's', value: '', type: 'secret' }] });
  assert.equal(e._postman_variable_scope, 'environment');
  assert.deepEqual(e.values.map((v) => v.type), ['default', 'secret']);
});

test('flattenRequests lists requests with their folder path', () => {
  const inner = folder('Inner', '', [request({ name: 'R2', path: '/b' })]);
  const flat = flattenRequests([folder('Outer', '', [request({ name: 'R1', path: '/a' }), inner])]);
  assert.deepEqual(flat.map((f) => [f.folder, f.item.name]), [['Outer', 'R1'], ['Outer / Inner', 'R2']]);
});

test('validateCollection reports structural problems', () => {
  assert.ok(validateCollection({}).length >= 4);
  const bad = {
    info: { name: 'X', schema: 'wrong', _postman_id: 'nope' },
    item: [
      { name: 'Dup', request: { method: 'GET', url: { raw: 'x' }, header: 'no', body: { mode: 'formdata' } }, event: [], response: 'no' },
      { name: 'Dup', item: [] },
      { name: '', item: [{ name: 'Inner', item: [] }] },
    ],
  };
  const text = validateCollection(bad).join('\n');
  for (const part of ['schema', '_postman_id', 'duplicate name', 'url must have', 'header must be an array', 'body must be raw', 'needs one test script', 'response must be an array', 'folder is empty', 'has no name']) {
    assert.match(text, new RegExp(part));
  }
});
