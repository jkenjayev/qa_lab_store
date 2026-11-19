import { createApp } from '../src/app.js';
import { createClock } from '../src/clock.js';
import { createDefects } from '../src/defects.js';
import { buildServices } from '../src/services/index.js';

/** Throwaway value used only by tests. The real password comes from the TRAINING_PASSWORD env var. */
export const TEST_PASSWORD = 'test-only-value';

/** Services with a controllable clock. `defects` is a flags object (createDefects / onlyDefects). */
export function makeServices(defects = createDefects('off'), now = '2026-11-19T13:10:00') {
  const clock = createClock({ fixedNow: now });
  return { clock, defects, ...buildServices({ clock, defects, trainingPassword: TEST_PASSWORD }) };
}

export const ADMIN = { id: 'staff-1', role: 'Admin', doctorId: null };
export const RECEPTION = { id: 'staff-2', role: 'Receptionist', doctorId: null };
export const DR_RAO = { id: 'staff-3', role: 'Doctor', doctorId: 'doctor-1' };

/** Runs the real Express app on an ephemeral port and gives a fetch with its own cookie jar. */
export async function startApp(defects = createDefects('off'), now = '2026-11-19T13:10:00', storage = undefined) {
  const clock = createClock({ fixedNow: now });
  const app = createApp({ defects, clock, trainingPassword: TEST_PASSWORD, ...(storage ? { storage } : {}) });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  function client() {
    const jar = new Map();
    const send = async (method, path, body) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
        },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      });
      for (const line of response.headers.getSetCookie()) {
        const [pair] = line.split(';');
        const [name, value] = pair.split('=');
        if (/Max-Age=0/i.test(line)) jar.delete(name);
        else jar.set(name, value);
      }
      const text = await response.text();
      let json;
      try { json = JSON.parse(text); } catch { json = undefined; }
      return { status: response.status, headers: response.headers, text, json };
    };
    return {
      get: (p) => send('GET', p),
      post: (p, b = {}) => send('POST', p, b),
      put: (p, b = {}) => send('PUT', p, b),
      raw: (m, p, b) => send(m, p, b),
    };
  }
  return { app, clock, client, close: () => new Promise((resolve) => server.close(resolve)) };
}
