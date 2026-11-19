import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServices } from './services/index.js';
import { snapshotFromSeed } from './storage/collections.js';
import { createMemoryStorage } from './storage/createStorage.js';
import { devRoutes, clockView } from './routes/devRoutes.js';
import { errorHandler } from './routes/http.js';
import { patientRoutes } from './routes/patientRoutes.js';
import { staffRoutes } from './routes/staffRoutes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['/', '/doctors', '/doctors/:id', '/register', '/login', '/book/confirm', '/my-appointments', '/admin', '/admin/*'];
const PROTECTED_API = /^\/api\/(staff|dashboard|schedules|admin|patients|reports)(\/|$)/;

/**
 * Builds the Express app from injected config: { defects, clock, trainingPassword, storage }.
 * Services live in app.locals so the reset route can swap in fresh data. `storage` says where data is
 * persisted (Notion or memory) and may hold initialData loaded from there.
 */
export function createApp({ defects, clock, trainingPassword, storage = createMemoryStorage() }) {
  const app = express();
  app.disable('x-powered-by');
  app.locals.defects = defects;
  app.locals.clock = clock;
  app.locals.storage = storage;
  const sink = storage.sink;
  app.locals.services = buildServices({ clock, defects, trainingPassword, initialData: storage.initialData, sink });
  /** Back to the fixed seed in memory at once; the stored rows are brought in line in the background. */
  app.locals.reset = () => {
    const services = buildServices({ clock, defects, trainingPassword, sink });
    app.locals.services = services;
    sink.replaceAll(snapshotFromSeed(services.seedData));
  };

  app.use(express.json({ limit: '100kb' }));

  // Back office pages and APIs must not be cached, otherwise the Back button shows them after logout.
  app.use((req, res, next) => {
    if (req.path.startsWith('/admin') || PROTECTED_API.test(req.path)) {
      // CB_BACK_AFTER_LOGOUT (Back button shows a protected page after logout): pages are cached for an hour.
      res.setHeader('Cache-Control', defects.CB_BACK_AFTER_LOGOUT ? 'private, max-age=3600' : 'no-store');
    }
    next();
  });

  app.get('/api/config', (_req, res) => res.json({ defects, ...clockView(clock) }));
  app.use('/api', patientRoutes());
  app.use('/api', staffRoutes());
  app.use(devRoutes());
  app.use('/src/shared', express.static(join(root, 'src', 'shared')));
  app.use(express.static(join(root, 'public'), { index: false }));
  app.get(PAGES, (_req, res) => res.sendFile(join(root, 'public', 'index.html')));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Topilmadi' }));
  app.use(errorHandler);
  return app;
}
