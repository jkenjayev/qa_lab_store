import { loadEnvLocal } from '../src/storage/env.js';
import { runSeed } from '../src/storage/cli.js';

loadEnvLocal();
runSeed({ argv: process.argv.slice(2) }).catch((error) => {
  console.error(`notion:seed failed: ${error.message}`);
  process.exit(1);
});
