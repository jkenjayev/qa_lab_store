import { createApp } from './src/app.js';
import { createClock } from './src/clock.js';
import { modeFromEnv } from './src/defects.js';
import { createStorage } from './src/storage/bootstrap.js';
import { loadEnvLocal } from './src/storage/env.js';

loadEnvLocal();
const mode = modeFromEnv(process.env);
const port = Number(process.env.PORT) || 3201;
const clock = createClock(process.env);

try {
  const storage = await createStorage({ env: process.env, clock, log: console.log });
  createApp({ mode, clock, storage }).listen(port, () => {
    console.log(`FreshCart (${mode === 'on' ? 'training build with seeded defects' : 'reference build'}) on http://localhost:${port}`);
    console.log(`Storage: ${storage.mode}. Clock: ${clock.now().toString()}`);
  });
} catch (error) {
  console.error(`Cannot start: ${error.message}`);
  process.exit(1);
}
