import { runSeed } from '../src/storage/commands.js';
import { loadEnvLocal } from '../src/storage/settings.js';

loadEnvLocal();
runSeed({ env: process.env }).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
