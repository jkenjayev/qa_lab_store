import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildClinicBook } from '../tools/build-clinicbook.mjs';
import { flattenRequests, validateCollection } from '../tools/collection-kit.mjs';
import { parseTests } from '../tools/run-collection.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { collection, environment } = buildClinicBook();
const requests = flattenRequests(collection.item);

test('the committed JSON files are exactly what the builder generates (run npm run build:clinicbook after changes)', () => {
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'ClinicBook.postman_collection.json'), 'utf8')), collection);
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'ClinicBook.postman_environment.json'), 'utf8')), environment);
});

test('the collection is a valid Postman v2.1.0 collection', () => {
  assert.deepEqual(validateCollection(collection), []);
  assert.equal(collection.info.schema, 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json');
});

test('there is one folder per Notion feature, in order, then the facilitator tools', () => {
  const ids = collection.item.map((f) => f.name.split(' ')[0]);
  assert.deepEqual(ids, ['C1.1', 'C1.2', 'C1.3', 'C1.4', 'C1.5', 'C2.1', 'C2.2', 'C2.3', 'C2.4', 'C2.5', 'Facilitator']);
  assert.equal(collection.item[0].name, 'C1.1 Doctor directory and filters');
  assert.equal(collection.item[9].name, 'C2.5 Daily report export');
  assert.ok(requests.length >= 90);
});

test('feature folders carry their acceptance criteria in Uzbek and every request has a description', () => {
  for (const f of collection.item.slice(0, 10)) {
    assert.match(f.description, /Qabul mezonlari/, f.name);
    assert.match(f.description, /AC1\./, f.name);
  }
  for (const { folder, item } of requests) {
    assert.ok(item.request.description.length > 20, `${folder} / ${item.name} needs a description`);
    if (folder !== 'Facilitator tools') assert.match(item.request.description, /Vazifa:/, item.name);
  }
  assert.match(collection.info.description, /Qanday ishlatiladi/);
});

test('every request has a status check and a basic shape check the runner can read', () => {
  for (const { folder, item } of requests) {
    const parsed = parseTests(item.event.find((e) => e.listen === 'test').script.exec);
    assert.ok(parsed.status?.length >= 1, `${folder} / ${item.name} has no status check`);
  }
});

test('only basic checks: acceptance-criteria results are never asserted with a single narrow status where defects can change them', () => {
  const lenient = ['empty reason', 'same doctor, same day', 'short password', 'future', 'end equal to start', 'shorten hours', 'doctor edits another', 'as receptionist', 'dashboard - as doctor', 'other doctor', 'already started', 'confirm new time', 'next week', 'unknown doctor', 'repeated wrong passwords'];
  for (const { item } of requests) {
    const parsed = parseTests(item.event.find((e) => e.listen === 'test').script.exec);
    if (lenient.some((key) => item.name.includes(key)) && !item.name.includes('GET /api/doctors/:id - unknown')) {
      assert.ok(parsed.status.length > 1, `${item.name} should accept every plausible status`);
    }
  }
});

test('no password is stored in the files: staffPassword is an empty secret and bodies use variables', () => {
  const staff = environment.values.find((v) => v.key === 'staffPassword');
  assert.deepEqual([staff.type, staff.value], ['secret', '']);
  assert.equal(environment.values.find((v) => v.key === 'baseUrl').value, 'http://localhost:3202');
  const text = JSON.stringify(collection);
  assert.ok(!/probe-only-value|choose-your-own/.test(text));
  for (const { item } of requests) {
    const body = item.request.body?.raw;
    if (body && /staff\/login/.test(item.request.url.raw) && /clinicbook\.test/.test(body)) {
      const password = JSON.parse(body).password;
      assert.ok(password === '{{staffPassword}}' || password === 'Wrong-value-1', `${item.name} password must be a variable`);
    }
  }
});

test('the first registration creates a unique email with a pre-request script and later requests reuse it', () => {
  const register = requests.find((r) => r.item.name.includes('valid registration')).item;
  assert.ok(register.event.some((e) => e.listen === 'prerequest' && e.script.exec[0].includes('Date.now()')));
  assert.match(register.request.body.raw, /\{\{patientEmail\}\}/);
  const login = requests.find((r) => r.item.name.includes('valid login')).item;
  assert.match(login.request.body.raw, /\{\{patientEmail\}\}/);
});

test('facilitator tools cover the dev endpoints', () => {
  const tools = collection.item.at(-1).item.map((i) => i.request.url.raw);
  for (const path of ['/api/dev/clock', '/api/dev/reset', '/api/dev/storage', '/api/dev/outbox', '/dev/outbox', '/api/config']) {
    assert.ok(tools.some((u) => u.endsWith(path)), path);
  }
});
