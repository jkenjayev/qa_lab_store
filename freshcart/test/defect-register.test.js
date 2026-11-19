import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DEFECT_IDS } from '../src/defects.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function filesIn(dir, ext, skip = []) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (skip.includes(name)) return [];
    return statSync(full).isDirectory() ? filesIn(full, ext, skip) : full.endsWith(ext) ? [full] : [];
  });
}
const read = (file) => readFileSync(file, 'utf8');

describe('defect register', () => {
  const readme = read(path.join(root, 'README.md'));
  const code = [...filesIn(path.join(root, 'src'), '.js'), ...filesIn(path.join(root, 'public/js'), '.js')]
    .filter((f) => !f.endsWith('src/defects.js'))
    .map(read)
    .join('\n');
  const tests = filesIn(path.join(root, 'test'), '.test.js')
    .filter((f) => !f.endsWith('defect-register.test.js'))
    .map(read)
    .join('\n');

  for (const id of DEFECT_IDS) {
    it(`${id} is in the answer key, used in the code and tested`, () => {
      assert.ok(readme.includes(`\`${id}\``), 'missing from README answer key');
      assert.ok(new RegExp(`defects\\.${id}\\b`).test(code), 'no `defects.ID` branch in the code');
      const mentions = tests.split(id).length - 1;
      assert.ok(mentions >= 2, 'expected a test with the defect on and one with it off');
    });
  }
});
