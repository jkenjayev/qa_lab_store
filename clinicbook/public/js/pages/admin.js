import { canAccess, menuFor, startPage } from '../../../src/shared/access.js';
import { MSG } from '../../../src/shared/messages.js';
import { get, post, put } from '../api.js';
import { initialFilters, sortBy, toQuery } from '../state/appointmentFilters.js';
import { mount, setHandlers, toast } from '../ui.js';
import {
  renderAdminLogin,
  renderAdminShell,
  renderAppointmentsPage,
  renderDashboard,
  renderForbidden,
  renderPatientRecord,
  renderReportsPage,
  renderSchedulePage,
} from '../views/admin.js';

/** Back office pages. */
export function createAdminPages({ app, go }) {
  const shell = (user, path, content) => renderAdminShell({ user, menu: menuFor(user.role, app.config.defects), path, content });
  const logoutHandler = { 'staff-logout': async () => { await post('/api/staff/logout'); go('/admin/login'); } };

  function login() {
    const notice = sessionStorage.getItem('cb_notice') ?? '';
    sessionStorage.removeItem('cb_notice');
    const draw = (message = notice, email = '') => {
      mount(renderAdminLogin({ message, email }));
      setHandlers({
        submit: {
          'staff-login': async (form) => {
            const { email, password } = Object.fromEntries(new FormData(form).entries());
            try {
              const result = await post('/api/staff/login', { email, password });
              go(result.redirect);
            } catch (error) {
              draw(error.message, email);
            }
          },
        },
      });
    };
    draw();
  }

  /** Runs `render(user)` for a signed-in staff member, or redirects to login / shows the 403 page. */
  async function guarded(route, render) {
    let user;
    try {
      ({ user } = await get('/api/staff/me'));
    } catch (error) {
      if (error.data?.expired) sessionStorage.setItem('cb_notice', error.message);
      return go('/admin/login');
    }
    const path = location.pathname;
    if (route.resource && !canAccess(user.role, route.resource, app.config.defects)) {
      mount(shell(user, path, renderForbidden(startPage(user.role))));
      return setHandlers({ click: logoutHandler });
    }
    try {
      await render(user, (content, handlers = {}) => {
        mount(shell(user, path, content));
        setHandlers({ ...handlers, click: { ...logoutHandler, ...handlers.click } });
      });
    } catch (error) {
      if (error.status === 401) return go('/admin/login');
      const content = error.status === 403 ? renderForbidden(startPage(user.role)) : `<div class="alert" role="alert">${error.message}</div>`;
      mount(shell(user, path, content));
      setHandlers({ click: logoutHandler });
    }
  }

  const dashboard = (route) => guarded(route, async (_user, show) => show(renderDashboard(await get('/api/dashboard'))));

  const appointments = (route) =>
    guarded(route, async (_user, show) => {
      let filters = initialFilters(app.config.today, app.config.defects);
      const doctors = (await get('/api/doctors')).map((d) => ({ id: d.id, name: d.name }));
      const draw = async () => {
        const result = await get(`/api/admin/appointments?${toQuery(filters)}`);
        const set = (patch) => { filters = { ...filters, ...patch, page: 1 }; draw(); };
        show(renderAppointmentsPage({ filters, doctors, result }), {
          change: {
            from: (el) => set({ from: el.value }),
            to: (el) => set({ to: el.value }),
            doctorId: (el) => set({ doctorId: el.value }),
            status: (el) => set({ status: el.value }),
          },
          click: {
            sort: (el) => { filters = sortBy(filters, el.dataset.column); draw(); },
            prev: () => { filters = { ...filters, page: filters.page - 1 }; draw(); },
            next: () => { filters = { ...filters, page: filters.page + 1 }; draw(); },
          },
        });
      };
      await draw();
    });

  const schedule = (route, doctorId) =>
    guarded(route, async (user, show) => {
      const id = doctorId ?? user.doctorId;
      let data = await get(`/api/schedules/${id}`);
      const readForm = () => {
        const days = {};
        for (let d = 0; d < 7; d += 1) {
          const field = (name) => document.querySelector(`[data-day="${d}"][data-field="${name}"]`);
          days[d] = field('off').checked ? { off: true } : { off: false, start: field('start').value, end: field('end').value };
        }
        return { slotMinutes: Number(document.getElementById('slot-length').value), days };
      };
      const draw = (extra = {}) =>
        show(renderSchedulePage({ data, ...extra }), {
          change: { 'doctor-picker': (el) => go(`/admin/schedules/${el.value}`) },
          click: {
            'save-schedule': () => save(false),
            'confirm-save': () => save(true),
          },
        });
      async function save(confirm) {
        try {
          data = await put(`/api/schedules/${id}`, { ...readForm(), confirm });
          draw({});
          toast(MSG.SCHEDULE_SAVED);
        } catch (error) {
          if (error.status === 409) return draw({ conflicts: error.data.details.conflicts });
          draw({ errors: error.data?.fields ?? {}, error: error.data?.fields && Object.keys(error.data.fields).length ? '' : error.message });
        }
      }
      draw();
    });

  const patient = (route, id) =>
    guarded(route, async (_user, show) => {
      const draw = async (all) => {
        const record = await get(`/api/patients/${id}${all ? '?all=1' : ''}`);
        show(renderPatientRecord(record), { click: { 'show-all': () => draw(true) } });
      };
      await draw(false);
    });

  const reports = (route) =>
    guarded(route, async (user, show) => {
      show(renderReportsPage({ date: app.config.today, role: user.role, defects: app.config.defects }), {
        click: {
          export: () => {
            const date = document.getElementById('report-date').value;
            const link = document.createElement('a');
            link.href = `/api/reports/daily?date=${encodeURIComponent(date)}&format=csv`;
            link.setAttribute('download', '');
            document.body.appendChild(link);
            link.click();
            link.remove();
          },
        },
      });
    });

  return { login, dashboard, appointments, schedule, patient, reports };
}
