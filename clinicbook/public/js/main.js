import { get } from './api.js';
import { matchRoute } from './router.js';
import { installListeners, setHandlers } from './ui.js';
import { createAdminPages } from './pages/admin.js';
import { createPatientPages } from './pages/patient.js';
import { mount } from './ui.js';

const app = { config: null, patient: null };

async function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  await render();
}

async function render() {
  setHandlers({});
  const route = matchRoute(location.pathname);
  const query = new URLSearchParams(location.search);
  const patientPages = createPatientPages({ app, go: navigate });
  const adminPages = createAdminPages({ app, go: navigate });

  if (!route && location.pathname.startsWith('/admin')) return navigate('/admin/login', { replace: true });
  if (!route || route.name === 'home') return navigate('/doctors', { replace: true });
  if (route.name.startsWith('admin-')) {
    switch (route.name) {
      case 'admin-login': return adminPages.login();
      case 'admin-dashboard': return adminPages.dashboard(route);
      case 'admin-appointments': return adminPages.appointments(route);
      case 'admin-my-schedule': return adminPages.schedule(route, undefined);
      case 'admin-schedule': return adminPages.schedule(route, route.params.doctorId);
      case 'admin-patient': return adminPages.patient(route, route.params.id);
      default: return adminPages.reports(route);
    }
  }

  try {
    app.patient = (await get('/api/patient/session')).patient;
  } catch {
    app.patient = null;
  }
  const page = { id: route.params.id, query };
  try {
    switch (route.name) {
      case 'doctors': return await patientPages.doctors();
      case 'doctor': return await patientPages.doctor(page);
      case 'register': return patientPages.register();
      case 'login': return patientPages.login(page);
      case 'booking': return await patientPages.booking(page);
      default: return await patientPages.myAppointments();
    }
  } catch (error) {
    mount(`<main><div class="alert" role="alert">${error.message}</div></main>`);
  }
}

async function boot() {
  app.config = await get('/api/config');
  installListeners(navigate);
  window.addEventListener('popstate', render);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && !app.config.defects.CB_BACK_AFTER_LOGOUT) render();
  });
  await render();
}

boot();
