import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { collection, environment, folder, request } from '../tools/collection-kit.mjs';
import { CookieJar, parseArgs, parsePrerequest, parseTests, pick, resolveVariables, runCollection } from '../tools/run-collection.mjs';

// ---------- a small fake API with a cookie login
let server;
let base;
const seen = [];
before(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push(`${req.method} ${req.url}`);
      const json = (status, value, headers = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
        res.end(JSON.stringify(value));
      };
      if (req.url === '/items') return json(200, [{ id: 'a1', n: 1 }]);
      if (req.url === '/object') return json(200, { user: { role: 'admin' }, count: 'x' });
      if (req.url === '/login' && req.method === 'POST') return json(200, { ok: true }, { 'Set-Cookie': 'sid=abc; Path=/; HttpOnly' });
      if (req.url === '/logout' && req.method === 'POST') return json(200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
      if (req.url === '/me') return req.headers.cookie?.includes('sid=abc') ? json(200, { name: 'me' }) : json(401, { error: 'no' });
      if (req.url === '/create' && req.method === 'POST') return json(201, { ref: 'R-1', echoed: JSON.parse(body) });
      if (req.url === '/use/R-1') return json(200, { used: true });
      if (req.url === '/text') {
        res.writeHead(200, { 'Content-Type': 'text/csv' });
        return res.end('a,b');
      }
      if (req.url === '/broken-json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('{nope');
      }
      return json(404, { error: 'missing' });
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

const run = (items, extra = {}) => runCollection({ collection: collection({ name: 'T', description: '', items, variables: [{ key: 'baseUrl', value: base }, ...(extra.variables ?? [])] }), ...extra });

// ---------- parsing helpers
test('parseTests reads status, oneOf, content type, properties, kinds and saves', () => {
  const parsed = parseTests([
    'pm.test("a", function () { pm.response.to.have.status(201); });',
    'pm.test("b", function () { pm.expect(pm.response.code).to.be.oneOf([200, 409]); });',
    'pm.test("c", function () { pm.expect(pm.response.headers.get("Content-Type")).to.include("text/csv"); });',
    'pm.test("d", function () { pm.expect(pm.response.json().user).to.have.property("role").that.is.a("string"); });',
    'pm.test("e", function () { pm.expect(pm.response.json()[0]).to.have.property("id"); });',
    'pm.test("f", function () { pm.expect(pm.response.json()).to.be.an("array"); });',
    'pm.collectionVariables.set("ref", pm.response.json().reference);',
    'pm.collectionVariables.set("first", pm.response.json()[0].id);',
    'console.log("ignored");',
  ]);
  assert.deepEqual(parsed.status, [200, 409]); // the later status line wins
  assert.deepEqual(parsed.contentTypes, ['text/csv']);
  assert.deepEqual(parsed.properties, [{ path: '.user', name: 'role', type: 'string' }, { path: '[0]', name: 'id', type: undefined }]);
  assert.deepEqual(parsed.kinds, [{ path: '', kind: 'array' }]);
  assert.deepEqual(parsed.saves, [{ variable: 'ref', path: '.reference' }, { variable: 'first', path: '[0].id' }]);
  assert.deepEqual(parseTests().status, null);
});

test('parsePrerequest reads the Date.now form only', () => {
  assert.deepEqual(parsePrerequest(['pm.collectionVariables.set("e", "t" + Date.now() + "@x");', 'other();']), [{ variable: 'e', prefix: 't', suffix: '@x' }]);
  assert.deepEqual(parsePrerequest(), []);
});

test('pick walks keys and indexes', () => {
  const data = { a: { b: [{ c: 5 }] }, z: null };
  assert.deepEqual(pick(data, '.a.b[0].c'), { found: true, value: 5 });
  assert.deepEqual(pick(data, ''), { found: true, value: data });
  assert.equal(pick(data, '.a.x').found, false);
  assert.equal(pick(data, '.z.q').found, false);
  assert.equal(pick(data, '.a.b[3]').found, false);
});

test('resolveVariables fills variables and dynamic values and lists the missing ones', () => {
  const out = resolveVariables('{{baseUrl}}/x/{{id}}/{{$timestamp}}/{{$randomInt}}/{{$guid}}/{{ gone }}/{{empty}}', { baseUrl: 'http://h', id: 7, empty: '' }, () => 0.5);
  assert.match(out.text, /^http:\/\/h\/x\/7\/\d{10}\/500\/[0-9a-f-]{36}\/\{\{ gone \}\}\/\{\{empty\}\}$/);
  assert.deepEqual(out.missing, ['gone', 'empty']);
  assert.ok(resolveVariables('{{$randomInt}}', {}).text.length > 0);
});

test('CookieJar stores, replaces and deletes cookies per host', () => {
  const jar = new CookieJar();
  assert.equal(jar.header('h'), '');
  jar.store('h', ['a=1; Path=/; HttpOnly', 'b=2']);
  jar.store('h', ['a=3']);
  assert.equal(jar.header('h'), 'a=3; b=2');
  jar.store('h', ['b=; Max-Age=0']);
  assert.equal(jar.header('h'), 'a=3');
  assert.equal(jar.header('other'), '');
});

test('parseArgs reads the command line', () => {
  const args = parseArgs(['c.json', '--env', 'e.json', '--var', 'a=1', '--var', 'b=x=y', '--folder', 'C1', '--before', 'POST /r', '--base-url', 'http://h', '--quiet']);
  assert.deepEqual(args, { file: 'c.json', env: 'e.json', vars: { a: '1', b: 'x=y' }, folder: 'C1', before: ['POST /r'], quiet: true, baseUrl: 'http://h' });
  assert.throws(() => parseArgs(['one.json', 'two.json']), /Unexpected argument/);
});

// ---------- running
test('runCollection checks status, shape, cookies and saved variables in order', async () => {
  const logs = [];
  const items = [
    folder('F1', '', [
      request({ name: 'list', path: '/items', tests: { json: 'array', itemFields: { id: 'string', n: 'number' } } }),
      request({ name: 'obj', path: '/object', tests: { fields: { count: 'string' }, nested: { user: { role: 'string' } } } }),
      request({ name: 'me before login', path: '/me', tests: { status: 401, fields: { error: 'string' } } }),
      request({ name: 'login', method: 'POST', path: '/login', body: {}, tests: { fields: { ok: 'boolean' } } }),
      request({ name: 'me after login', path: '/me', tests: { fields: { name: 'string' } } }),
      request({ name: 'logout', method: 'POST', path: '/logout', body: {}, tests: {} }),
      request({ name: 'me after logout', path: '/me', tests: { status: [200, 401], fields: {} } }),
      request({ name: 'create and save', method: 'POST', path: '/create', body: { who: '{{who}}' }, prerequest: ['pm.collectionVariables.set("who", "u" + Date.now() + "!");'], tests: { status: 201, fields: { ref: 'string' }, nested: { echoed: { who: 'string' } }, save: { ref: 'ref' } } }),
      request({ name: 'use saved', path: '/use/{{ref}}', tests: { fields: { used: 'boolean' } } }),
      request({ name: 'csv', path: '/text', tests: { json: false, contentType: 'text/csv' } }),
    ]),
  ];
  const result = await run(items, { log: (l) => logs.push(l) });
  assert.deepEqual(result.results.filter((r) => !r.ok).map((r) => [r.name, r.errors]), []);
  assert.equal(result.passed, 10);
  assert.equal(result.variables.ref, 'R-1');
  assert.match(result.variables.who, /^u\d+!$/);
  assert.equal(logs.filter((l) => l.startsWith('PASS')).length, 10);
});

test('runCollection reports wrong status, missing fields, wrong types and content type', async () => {
  const items = [
    folder('F', '', [
      request({ name: 'status', path: '/items', tests: { status: 201, json: false } }),
      request({ name: 'field', path: '/object', tests: { fields: { missing: 'string' } } }),
      request({ name: 'type', path: '/object', tests: { fields: { count: 'number' } } }),
      request({ name: 'kind', path: '/object', tests: { json: 'array' } }),
      request({ name: 'content type', path: '/items', tests: { json: false, contentType: 'text/csv' } }),
      request({ name: 'not json', path: '/broken-json', tests: { fields: { a: 'string' } } }),
      request({ name: 'unsaveable', path: '/object', tests: { save: { v: 'nothing.here' } } }),
    ]),
  ];
  const { results, failed } = await run(items);
  assert.equal(failed, 7);
  const errors = Object.fromEntries(results.map((r) => [r.name, r.errors.join(' | ')]));
  assert.match(errors.status, /status 200, expected 201/);
  assert.match(errors.field, /no property missing/);
  assert.match(errors.type, /is string, expected number/);
  assert.match(errors.kind, /is not an array/);
  assert.match(errors['content type'], /Content-Type is not text\/csv/);
  assert.match(errors['not json'], /no property a/);
  assert.match(errors.unsaveable, /could not save v/);
});

test('runCollection stops a request with unresolved variables and survives network errors', async () => {
  const items = [folder('F', '', [request({ name: 'needs var', path: '/use/{{nothing}}', tests: {} }), request({ name: 'refused', path: '/x', tests: {} })])];
  const result = await run(items, { baseUrlOverride: 'http://127.0.0.1:1' });
  assert.match(result.results[0].errors[0], /unresolved variable\(s\): nothing/);
  assert.match(result.results[1].errors[0], /request failed/);
});

test('runCollection merges variables: collection < environment < --var, and honours folder filter and before hooks', async () => {
  seen.length = 0;
  const items = [
    folder('Alpha', '', [request({ name: 'a', path: '/use/{{ref}}', tests: { fields: { used: 'boolean' } } })]),
    folder('Beta', '', [request({ name: 'b', path: '/items', tests: { json: 'array' } })]),
  ];
  const env = environment({ name: 'E', values: [{ key: 'ref', value: 'WRONG' }, { key: 'empty', value: '' }] });
  const result = await run(items, {
    environment: env,
    vars: { ref: 'R-1' },
    folder: 'Alpha',
    before: ['POST /login {"x":1}', 'GET /items'],
    variables: [{ key: 'ref', value: 'COLLECTION' }],
  });
  assert.equal(result.passed, 1);
  assert.deepEqual(seen, ['POST /login', 'GET /items', 'GET /use/R-1']);
  await assert.rejects(run(items, { before: ['nonsense'] }), /Bad --before value/);
});

test('runCollection treats a request without status checks as passing on any status', async () => {
  const bare = { name: 'bare', request: { method: 'GET', header: [], url: { raw: '{{baseUrl}}/items', host: ['{{baseUrl}}'], path: ['items'] } }, event: [], response: [] };
  const { results } = await run([folder('F', '', [bare])]);
  assert.equal(results[0].ok, true);
});
