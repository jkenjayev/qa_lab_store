import { MSG } from '../../../src/shared/messages.js';
import { passwordRuleStates, validateRegistration } from '../../../src/shared/rules.js';
import { get, post } from '../api.js';
import { continueTime, toggleSlot } from '../state/slotSelection.js';
import { emptyFilters, resetFilters, toQuery } from '../state/doctorFilters.js';
import { needsConfirmation } from '../state/cancel.js';
import { formValues, mount, setHandlers, toast } from '../ui.js';
import { renderPatientHeader } from '../views/common.js';
import {
  renderBookingSummary,
  renderCancelDialog,
  renderConfirmation,
  renderDoctorPage,
  renderDoctorsPage,
  renderLoginForm,
  renderMyAppointments,
  renderRegisterForm,
  renderRules,
} from '../views/patient.js';

/** Patient portal pages. Each function renders a page and wires its events. */
export function createPatientPages({ app, go }) {
  const header = (path) => renderPatientHeader({ patient: app.patient, path });
  const requireLogin = () => {
    if (app.patient) return true;
    go(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    return false;
  };

  async function doctors() {
    let filters = emptyFilters();
    const specialties = await get('/api/specialties');
    const draw = async () => {
      const list = await get(`/api/doctors?${toQuery(filters)}`);
      mount(header('/doctors') + renderDoctorsPage({ doctors: list, specialties, filters }));
      setHandlers({
        change: {
          name: (el) => { filters = { ...filters, name: el.value }; draw(); },
          specialty: (el) => { filters = { ...filters, specialty: el.value }; draw(); },
          sort: (el) => { filters = { ...filters, sort: el.value }; draw(); },
        },
        click: { 'reset-filters': () => { filters = resetFilters(filters, app.config.defects); draw(); } },
      });
    };
    await draw();
  }

  async function doctor({ id, query }) {
    const [doc, weekData] = await Promise.all([get(`/api/doctors/${id}`), get(`/api/doctors/${id}/week`)]);
    const reschedule = query.get('reschedule');
    const state = { date: null, times: [], selected: [] };
    const draw = () => {
      mount(header('/doctors') + renderDoctorPage({ doctor: doc, week: weekData.days, ...state, defects: app.config.defects, reschedule }));
      setHandlers({
        click: {
          'pick-day': async (el) => {
            state.date = el.dataset.date;
            state.selected = [];
            state.times = (await get(`/api/doctors/${id}/slots?date=${state.date}`)).times;
            draw();
          },
          'pick-slot': (el) => { state.selected = toggleSlot(state.selected, el.dataset.time, app.config.defects); draw(); },
          continue: () => {
            const time = continueTime(state.selected);
            if (!time) return;
            const extra = reschedule ? `&reschedule=${encodeURIComponent(reschedule)}` : '';
            go(`/book/confirm?doctor=${id}&date=${state.date}&time=${time}${extra}`);
          },
        },
      });
    };
    draw();
  }

  function register() {
    const values = {};
    const errors = {};
    const draw = (done = false) => {
      mount(header('/register') + renderRegisterForm({ values, errors, ruleStates: passwordRuleStates(values.password ?? ''), done }));
      setHandlers({
        input: { password: (el) => { document.querySelector('.rules').innerHTML = renderRules(passwordRuleStates(el.value)); } },
        submit: {
          register: async (form) => {
            Object.assign(values, formValues(form));
            for (const key of Object.keys(errors)) delete errors[key];
            Object.assign(errors, validateRegistration(values, { today: app.config.today, emailTaken: () => false, defects: app.config.defects }));
            if (Object.keys(errors).length === 0) {
              try {
                await post('/api/patient/register', values);
                return draw(true);
              } catch (error) {
                Object.assign(errors, error.data?.fields ?? { email: error.message });
              }
            }
            draw();
          },
        },
      });
    };
    draw();
  }

  function login({ query }) {
    const draw = (message = '', email = '') => {
      mount(header('/login') + renderLoginForm({ message, email }));
      setHandlers({
        submit: {
          login: async (form) => {
            const { email, password } = Object.fromEntries(new FormData(form).entries());
            try {
              const result = await post('/api/patient/login', { email, password });
              app.patient = result.patient;
              go(query.get('next') || '/my-appointments');
            } catch (error) {
              draw(error.message, email);
            }
          },
        },
      });
    };
    draw();
  }

  async function booking({ query }) {
    if (!requireLogin()) return;
    const id = query.get('doctor');
    const [date, time, reschedule] = [query.get('date'), query.get('time'), query.get('reschedule')];
    const doc = await get(`/api/doctors/${id}`);
    const draw = (reason = '', error = '') => {
      mount(header('/doctors') + renderBookingSummary({ doctor: doc, date, time, reason, error }));
      setHandlers({
        click: {
          back: () => history.back(),
          'confirm-booking': async () => {
            const text = document.getElementById('reason').value;
            try {
              if (reschedule) {
                await post(`/api/appointments/${encodeURIComponent(reschedule)}/reschedule`, { date, time });
                toast('Qabul boshqa vaqtga koʻchirildi');
                return go('/my-appointments');
              }
              const result = await post('/api/bookings', { doctorId: id, date, time, reason: text });
              mount(header('/doctors') + renderConfirmation(result));
              setHandlers({});
            } catch (err) {
              if (err.status === 409 && err.message === MSG.SLOT_TAKEN) {
                toast(err.message);
                return go(`/doctors/${id}`);
              }
              draw(text, err.message);
            }
          },
        },
      });
    };
    draw();
  }

  async function myAppointments() {
    if (!requireLogin()) return;
    let tab = 'upcoming';
    let error = '';
    const draw = async () => {
      const data = await get('/api/appointments/mine');
      mount(header('/my-appointments') + renderMyAppointments({ tab, data, error }));
      const find = (ref) => data.upcoming.find((a) => a.reference === ref);
      const doCancel = async (ref) => {
        try { await post(`/api/appointments/${encodeURIComponent(ref)}/cancel`); error = ''; } catch (e) { error = e.message; }
        draw();
      };
      setHandlers({
        click: {
          tab: (el) => { tab = el.dataset.tab; draw(); },
          cancel: (el) => {
            const ref = el.dataset.ref;
            if (!needsConfirmation(app.config.defects)) return doCancel(ref);
            document.getElementById('app').insertAdjacentHTML('beforeend', renderCancelDialog(find(ref)));
            setHandlers({ click: { keep: () => draw(), 'confirm-cancel': (b) => doCancel(b.dataset.ref) } });
          },
          reschedule: async (el) => {
            try {
              const start = await post(`/api/appointments/${encodeURIComponent(el.dataset.ref)}/reschedule-start`);
              go(`/doctors/${start.doctorId}?reschedule=${encodeURIComponent(start.reference)}`);
            } catch (e) { error = e.message; draw(); }
          },
          'patient-logout': async () => { await post('/api/patient/logout'); app.patient = null; go('/login'); },
        },
      });
    };
    await draw();
  }

  return { doctors, doctor, register, login, booking, myAppointments };
}
