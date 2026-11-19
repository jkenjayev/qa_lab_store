import { canAccess } from '../../../src/shared/access.js';
import { DAY_LABEL, roleLabel, statusLabel } from '../../../src/shared/labels.js';
import { MSG } from '../../../src/shared/messages.js';
import { alertBox, esc, fieldError } from './common.js';

export function renderAdminLogin({ message, email = '' }) {
  return `<main><h1>ClinicBook xodimlari</h1>${alertBox(message)}
    <form id="staff-login" class="card" novalidate>
      <label>Email<input id="email" name="email" type="email" value="${esc(email)}" /></label>
      <label>Parol<input id="password" name="password" type="password" /></label>
      <button type="submit">Kirish</button>
    </form></main>`;
}

export function renderAdminShell({ user, menu, path, content }) {
  const links = menu.map((m) => `<a href="${m.href}" class="${path.startsWith(m.href.replace(/\/doctor-1$/, '')) ? 'active' : ''}">${esc(m.label)}</a>`).join('');
  return `<header class="admin"><a class="brand" href="/admin">ClinicBook</a><span>${esc(user.name)} (${esc(roleLabel(user.role))})</span>
    <button class="secondary" data-action="staff-logout">Chiqish</button></header>
    <div class="admin-layout"><aside>${links}</aside><section class="content">${content}</section></div>`;
}

export function renderForbidden(startHref) {
  return `<div class="error-page"><h1>403</h1><p>${MSG.FORBIDDEN}</p><a class="button" href="${esc(startHref)}">Bosh sahifamga oʻtish</a></div>`;
}

export function renderDashboard(stats) {
  return `<h1>Boshqaruv paneli</h1><div class="grid">
    <div class="card"><h2>${stats.appointmentsToday}</h2>Bugungi qabullar</div>
    <div class="card"><h2>${stats.upcomingAppointments}</h2>Kelgusi qabullar</div>
    <div class="card"><h2>${stats.doctors}</h2>Shifokorlar</div>
    <div class="card"><h2>${stats.patients}</h2>Bemorlar</div></div>`;
}

const COLUMNS = [['reference', 'Raqam'], ['patient', 'Bemor'], ['doctor', 'Shifokor'], ['date', 'Sana'], ['time', 'Vaqt'], ['status', 'Holat']];
const STATUSES = ['Booked', 'Completed', 'Cancelled', 'No-show'];

export function renderAppointmentsPage({ filters, doctors, result }) {
  const doctorOptions = ['<option value="">Barchasi</option>'].concat(doctors.map((d) => `<option value="${esc(d.id)}" ${d.id === filters.doctorId ? 'selected' : ''}>${esc(d.name)}</option>`)).join('');
  const statusOptions = ['<option value="">Barchasi</option>'].concat(STATUSES.map((s) => `<option value="${s}" ${s === filters.status ? 'selected' : ''}>${statusLabel(s)}</option>`)).join('');
  const head = COLUMNS.map(([k, label]) => `<th><button data-action="sort" data-column="${k}">${label}${filters.sort === k ? (filters.dir === 'asc' ? ' ▲' : ' ▼') : ''}</button></th>`).join('');
  const rows = result.rows
    .map((r) => `<tr><td>${esc(r.reference)}</td><td><a href="/admin/patients/${esc(r.patientId)}">${esc(r.patient)}</a></td><td>${esc(r.doctor)}</td><td>${esc(r.dateText)}</td><td>${esc(r.time)}</td><td><span class="chip ${esc(r.status)}">${esc(statusLabel(r.status))}</span></td></tr>`)
    .join('');
  return `<h1>Qabullar</h1><div class="filters">
    <label>Sanadan<input id="from" type="date" value="${esc(filters.from)}" /></label>
    <label>Sanagacha<input id="to" type="date" value="${esc(filters.to)}" /></label>
    <label>Shifokor<select id="doctorId">${doctorOptions}</select></label>
    <label>Holat<select id="status">${statusOptions}</select></label></div>
    <table><thead><tr>${head}</tr></thead><tbody>${rows || `<tr><td colspan="6">${MSG.NO_APPOINTMENTS}</td></tr>`}</tbody></table>
    <div class="row"><span id="counter">${esc(result.counter)}</span>
      <button class="secondary" data-action="prev" ${result.page <= 1 ? 'disabled' : ''}>Oldingi</button>
      <span>Sahifa ${result.page} / ${result.lastPage}</span>
      <button class="secondary" data-action="next" ${result.page >= result.lastPage ? 'disabled' : ''}>Keyingi</button></div>`;
}

const DAY_NAMES = DAY_LABEL;
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function renderSchedulePage({ data, errors = {}, conflicts = null, notice = '', error = '' }) {
  const { schedule } = data;
  const picker = data.doctors
    ? `<label>Shifokor<select id="doctor-picker">${data.doctors.map((d) => `<option value="${esc(d.id)}" ${d.id === data.doctor.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>`
    : '';
  const rows = WEEK_ORDER.map((d) => {
    const day = schedule.days[d];
    return `<tr><td>${DAY_NAMES[d]}</td><td><input type="checkbox" data-day="${d}" data-field="off" ${day.off ? 'checked' : ''} /></td>
      <td><input type="time" data-day="${d}" data-field="start" value="${esc(day.start ?? '')}" ${day.off ? 'disabled' : ''} /></td>
      <td><input type="time" data-day="${d}" data-field="end" value="${esc(day.end ?? '')}" ${day.off ? 'disabled' : ''} />${fieldError(errors, DAY_NAMES[d])}</td></tr>`;
  }).join('');
  const lengths = [15, 30, 45].map((m) => `<option value="${m}" ${m === schedule.slotMinutes ? 'selected' : ''}>${m} daqiqa</option>`).join('');
  const warning = conflicts
    ? `<div class="alert" role="alert"><strong>${MSG.SCHEDULE_CONFLICT}:</strong><ul>${conflicts.map((c) => `<li>${esc(c.reference)}, ${esc(c.patient)}, ${esc(c.date)} ${esc(c.time)}</li>`).join('')}</ul>
      <button data-action="confirm-save">Baribir saqlash</button></div>`
    : '';
  return `<h1>Jadval: ${esc(data.doctor.name)}</h1>${alertBox(error)}${warning}${notice ? `<div class="toast" role="status">${esc(notice)}</div>` : ''}
    <div class="filters">${picker}<label>Qabul davomiyligi<select id="slot-length">${lengths}</select></label></div>
    <table><thead><tr><th>Kun</th><th>Dam olish kuni</th><th>Boshlanishi</th><th>Tugashi</th></tr></thead><tbody>${rows}</tbody></table>
    <p><button data-action="save-schedule">Jadvalni saqlash</button></p>
    <h2>Kelgusi band qilingan qabullar</h2>
    <table><tbody>${data.appointments.map((a) => `<tr><td>${esc(a.reference)}</td><td>${esc(a.patientName)}</td><td>${esc(a.dateText)}</td><td>${esc(a.time)}</td></tr>`).join('') || '<tr><td>Yoʻq</td></tr>'}</tbody></table>`;
}

export function renderPatientRecord(record) {
  const rows = record.visits.map((v) => `<tr><td>${esc(v.date)}</td><td>${esc(v.doctor)}</td><td><span class="chip ${esc(v.status)}">${esc(statusLabel(v.status))}</span></td></tr>`).join('');
  return `<h1>Bemor: ${esc(record.fullName)}</h1><div class="card">
    <p>Tugʻilgan sana: ${esc(record.dob)} (yoshi: ${record.age})</p><p>Telefon: ${esc(record.phone)}</p><p>Email: ${esc(record.email)}</p></div>
    <h2>Tashriflar tarixi (yangilari birinchi)</h2>
    ${record.visits.length ? `<table><thead><tr><th>Sana</th><th>Shifokor</th><th>Holat</th></tr></thead><tbody>${rows}</tbody></table>` : `<p id="no-visits">${MSG.NO_VISITS}</p>`}
    ${record.hasMore ? '<p><button class="secondary" data-action="show-all">Barcha tashriflarni koʻrsatish</button></p>' : ''}`;
}

export function renderReportsPage({ date, role, defects }) {
  const canExport = canAccess(role, 'reports', defects);
  return `<h1>Kunlik qabullar hisoboti</h1>
    <div class="filters"><label>Sana<input id="report-date" type="date" value="${esc(date)}" /></label>
    <label>Format<select id="report-format"><option value="csv">CSV</option><option value="pdf" disabled>PDF (Tez orada)</option></select></label>
    ${canExport ? '<button data-action="export">Eksport</button>' : ''}</div>`;
}
