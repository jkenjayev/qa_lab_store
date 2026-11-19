import { createApp } from './src/app.js';
import { loadConfig } from './src/config.js';
import { createStorage } from './src/storage/createStorage.js';
import { loadEnvLocal } from './src/storage/settings.js';

loadEnvLocal();

let config;
let storage;
try {
  config = loadConfig(process.env);
  storage = await createStorage({ env: process.env, trainingPassword: config.trainingPassword });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

createApp({ ...config, storage }).listen(config.port, () => {
  const mode = Object.values(config.defects).some(Boolean) ? 'xatolar bilan' : 'etalon versiya (xatosiz)';
  console.warn(`ClinicBook http://localhost:${config.port} manzilida ishlamoqda (${mode}), saqlash: ${storage.mode}`);
});
