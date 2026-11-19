/** Load .env.local into process.env (existing variables win). A missing file is fine. */
export function loadEnvLocal(file = '.env.local', loader = process.loadEnvFile) {
  try {
    loader.call(process, file);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export const DEFAULT_PARENT_PAGE_ID = '41d2b9c9-59ab-81b3-ba6f-eda97451cd66';
