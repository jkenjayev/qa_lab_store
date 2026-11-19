import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runCollection } from '../../postman/tools/run-collection.mjs';
import { SCHEMA, folder, request, shapeToKit, validateCollection } from '../src/postman/builder.js';
import { buildCollection, buildEnvironment } from '../src/postman/freshcart.js';
import { startServer } from './helpers.js';

const postmanDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'postman');
const FEATURES = ['F1.1', 'F1.2', 'F1.3', 'F1.4', 'F1.5', 'F2.1', 'F2.2', 'F2.3', 'F2.4', 'F2.5'];

const allRequests = (collection) => collection.item.flatMap((f) => f.item);
const scriptOf = (item) => item.event.find((e) => e.listen === 'test').script.exec.join('\n');

describe('postman builder adapter', () => {
  it('splits a shape into top-level and nested checks', () => {
    assert.deepEqual(shapeToKit({ cartId: 'string', 'totals.subtotalCents': 'number', 'a.b.c': 'array' }), {
      fields: { cartId: 'string' },
      at: { '.totals': { subtotalCents: 'number' }, '.a.b': { c: 'array' } },
    });
    assert.deepEqual(shapeToKit(), { fields: {}, at: {} });
  });

  it('writes status, shape, saved variables and the cart header into a request', () => {
    const item = request(
      { name: 'n', method: 'POST', path: '/api/cart/items', cart: true, body: { productId: 1 }, shape: { cartId: 'string', 'totals.totalCents': 'number' }, save: { cartId: 'cartId' }, ac: [2], description: 'tavsif' },
      ['bir', 'ikki'],
    );
    const script = scriptOf(item);
    assert.match(script, /pm\.response\.to\.have\.status\(200\)/);
    assert.match(script, /\.to\.have\.property\("cartId"\)\.that\.is\.a\("string"\)/);
    assert.match(script, /pm\.response\.json\(\)\.totals\)\.to\.have\.property\("totalCents"\)/);
    assert.match(script, /pm\.collectionVariables\.set\("cartId", pm\.response\.json\(\)\.cartId\)/);
    assert.deepEqual(item.request.header.map((h) => h.key), ['X-Cart-Id', 'Content-Type']);
    assert.match(item.request.description, /tavsif\n\nQabul mezonlari:\n- AC2\. ikki/);
  });

  it('adds no body checks when several statuses are allowed, and an error check when all are errors', () => {
    const mixed = scriptOf(request({ name: 'm', path: '/x', expect: [200, 400], shape: { id: 'number' }, save: { v: 'id' } }));
    assert.match(mixed, /oneOf\(\[200, 400\]\)/);
    assert.doesNotMatch(mixed, /property\("id"\)/);
    assert.doesNotMatch(mixed, /collectionVariables/);
    assert.match(scriptOf(request({ name: 'e', path: '/x', expect: 404 })), /property\("error"\)\.that\.is\.a\("string"\)/);
    assert.doesNotMatch(scriptOf(request({ name: 'i', path: '/x', json: false, contentType: 'image/svg+xml' })), /property\("error"\)/);
  });

  it('builds a folder whose description lists every criterion', () => {
    const f = folder('F9', ['a', 'b'], [{ name: 'r', path: '/x' }], 'kirish');
    assert.match(f.description, /^kirish\n\nQabul mezonlari/);
    assert.match(f.description, /AC2\. b/);
    assert.equal(f.item.length, 1);
    assert.equal(request({ name: 'plain', path: '/x' }).request.description, '');
  });
});

describe('FreshCart collection structure', () => {
  const collection = buildCollection();

  it('is a valid Postman v2.1.0 collection with one folder per feature plus Facilitator tools', () => {
    assert.deepEqual(validateCollection(collection), []);
    assert.equal(collection.info.schema, SCHEMA);
    assert.match(collection.info.name, /FreshCart/);
    assert.deepEqual(collection.item.map((f) => f.name.split(' ')[0]).slice(0, 10), FEATURES);
    assert.equal(collection.item.at(-1).name, 'Facilitator tools');
    assert.ok(allRequests(collection).length >= 80);
  });

  it('gives every request a baseUrl URL, a description and a status check', () => {
    for (const item of allRequests(collection)) {
      assert.ok(item.request.url.raw.startsWith('{{baseUrl}}/'), item.name);
      assert.ok(item.request.description.length > 10, item.name);
      assert.match(scriptOf(item), /to\.have\.status\(\d+\)|oneOf\(\[/, item.name);
    }
  });

  it('puts Uzbek criteria on the feature folders and keeps the negative cases', () => {
    for (const f of collection.item.slice(0, 10)) assert.match(f.description, /Qabul mezonlari/);
    const names = allRequests(collection).map((r) => r.name).join('\n');
    for (const needle of ['99999', "noma'lum kod", "bo'sh savat", "noto'g'ri karta", "to'lgan vaqt"]) assert.match(names, new RegExp(needle));
  });

  it('has no credentials and declares every variable the requests use', () => {
    const text = JSON.stringify(collection);
    assert.doesNotMatch(text, /password|secret|token|api[_-]?key/i);
    const declared = new Set(collection.variable.map((v) => v.key));
    for (const used of text.match(/\{\{(\w+)\}\}/g).map((m) => m.slice(2, -2))) assert.ok(declared.has(used), used);
    assert.equal(collection.variable.find((v) => v.key === 'baseUrl').value, 'http://localhost:3201');
  });

  it('has a matching environment', () => {
    const env = buildEnvironment();
    assert.equal(env.name, 'FreshCart (local)');
    assert.equal(env._postman_variable_scope, 'environment');
    assert.deepEqual(env.values.map((v) => v.key), collection.variable.map((v) => v.key));
    assert.equal(env.values.find((v) => v.key === 'baseUrl').value, 'http://localhost:3201');
  });

  it('is in sync with the files in qa-lab-apps/postman (run npm run postman:build after editing)', () => {
    const colFile = join(postmanDir, 'FreshCart.postman_collection.json');
    const envFile = join(postmanDir, 'FreshCart.postman_environment.json');
    assert.ok(existsSync(colFile) && existsSync(envFile), 'run npm run postman:build');
    assert.deepEqual(JSON.parse(readFileSync(colFile, 'utf8')), collection);
    assert.deepEqual(JSON.parse(readFileSync(envFile, 'utf8')), buildEnvironment());
  });
});

describe('FreshCart collection runs end to end with the shared runner', () => {
  let on;
  let off;
  before(async () => {
    on = await startServer({ mode: 'on' });
    off = await startServer({ mode: 'off' });
  });
  after(async () => {
    await on.close();
    await off.close();
  });

  for (const [label, get] of [['training build', () => on], ['reference build', () => off]]) {
    it(`every request passes its checks (${label})`, async () => {
      const { results, failed, variables } = await runCollection({
        collection: buildCollection(),
        environment: buildEnvironment(),
        baseUrlOverride: get().url,
      });
      assert.equal(failed, 0, JSON.stringify(results.filter((r) => !r.ok)));
      assert.ok(results.length >= 80);
      assert.ok(variables.cartId && variables.lineId, JSON.stringify(variables));
      assert.match(String(variables.orderNumber), /^FC-\d{6}$/);
    });
  }
});
