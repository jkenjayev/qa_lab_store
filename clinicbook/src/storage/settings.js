import { existsSync } from 'node:fs';

/** Page "App Data (written by FreshCart and ClinicBook)" in the QA Simulation Lab. Not a secret. */
export const DEFAULT_PARENT_PAGE_ID = '41d2b9c9-59ab-81b3-ba6f-eda97451cd66';

/** Loads .env.local (if it exists) into process.env without overriding values already set. */
export function loadEnvLocal(path = '.env.local', env = process.env) {
  if (!existsSync(path)) return false;
  // process.loadEnvFile always writes to process.env, so only use it for the real environment.
  if (env === process.env) {
    process.loadEnvFile(path);
    return true;
  }
  return false;
}
