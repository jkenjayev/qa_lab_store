import { loadEnvLocal } from '../src/storage/env.js';
import { runVerify } from '../src/storage/cli.js';

loadEnvLocal();
runVerify().catch((error) => {
  console.error(`notion:verify failed: ${error.message}`);
  process.exit(1);
});
