import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCollection, buildEnvironment } from '../src/postman/freshcart.js';

/** Writes ../postman/FreshCart.postman_collection.json and ...postman_environment.json */
const out = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'postman');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'FreshCart.postman_collection.json'), `${JSON.stringify(buildCollection(), null, 2)}\n`);
writeFileSync(join(out, 'FreshCart.postman_environment.json'), `${JSON.stringify(buildEnvironment(), null, 2)}\n`);
console.log(`Wrote the FreshCart collection and environment to ${out}`);
