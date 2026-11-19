import { runVerify } from '../src/storage/commands.js';
import { loadEnvLocal } from '../src/storage/settings.js';

loadEnvLocal();
runVerify({ env: process.env }).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
