import { slotLabel } from '../../../src/shared/slotLabel.js';
import { MSG } from '../../../src/shared/messages.js';
import { statusLabel } from '../../../src/shared/labels.js';
import { formatDateLong } from '../../../src/shared/time.js';
import { isDayClickable } from '../state/slotSelection.js';
import { alertBox, esc, fieldError } from './common.js';

const FIELD = (label, control, errors, name) => `<label>${label}<div>${control}${fieldError(errors, name)}</div></label>`;

export function renderDoctorCard(doctor) {
  return `<article class="card doctor" data-doctor="${esc(doctor.id)}">
    <div class="avatar">${esc(doctor.initials)}</div>
    <h2>${esc(doctor.name)}</h2>
    <div>${esc(doctor.specialty)}</div>
    <div>${doctor.years} yil tajriba</div>
    <div>Eng yaqin vaqt: ${esc(doctor.nextAvailableText)}</div>
    <p><a class="button" href="/doctors/${esc(doctor.id)}">Vaqtlarni koʻrish</a></p>
  </article>`;
}

export function renderDoctorsPage({ doctors, specialties, filters }) {
  const options = ['<option value="">Barcha mutaxassisliklar</option>']
    .concat(specialties.map((s) => `<option ${s === filters.specialty ? 'selected' : ''}>${esc(s)}</option>`))
    .join('');
  const sorts = [['next', 'Eng yaqin boʻsh vaqt'], ['experience', 'Tajriba (koʻpdan kamga)']]
    .map(([v, l]) => `<option value="${v}" ${v === filters.sort ? 'selected' : ''}>${l}</option>`)
    .join('');
  const body = doctors.length
    ? `<div class="grid">${doctors.map(renderDoctorCard).join('')}</div>`
    : `<div class="card"><p>${MSG.NO_DOCTORS}</p><button data-action="reset-filters">Filtrlarni tozalash</button></div>`;
  return `<main><h1>Shifokorni toping</h1>
    <div class="filters">
      <label>Qidirish<input id="name" type="text" value="${esc(filters.name)}" placeholder="ism..." /></label>
      <label>Mutaxassislik<select id="specialty">${options}</select></label>
      <label>Saralash<select id="sort">${sorts}</select></label>
    </div>${body}</main>`;
}

export function renderDoctorPage({ doctor, week, date, times, selected, defects, reschedule }) {
  const days = week
    .map((d) => {
      const clickable = isDayClickable(d, defects);
      return `<button class="day ${d.hasSlots ? 'free' : 'grey'} ${d.date === date ? 'selected' : ''}" data-action="pick-day" data-date="${d.date}" ${clickable ? '' : 'disabled'}>${esc(d.weekday)} ${d.day}</button>`;
    })
    .join('');
  const slots = times
    .map((t) => `<button class="slot ${selected.includes(t) ? 'selected' : ''}" data-action="pick-slot" data-time="${t}">${esc(slotLabel(t, defects))}</button>`)
    .join('');
  return `<main><h1>${esc(doctor.name)}, ${esc(doctor.specialty)}</h1>
    ${reschedule ? `<p class="note">${esc(reschedule)} raqamli qabul uchun yangi vaqtni tanlang.</p>` : ''}
    <p class="note" id="tz-note">${MSG.TIME_ZONE_NOTE}</p>
    <div class="week">${days}</div>
    ${date ? `<h2>${esc(formatDateLong(date))} kuni boʻsh vaqtlar</h2><div class="slots">${slots}</div>` : ''}
    <button data-action="continue" ${selected.length ? '' : 'disabled'}>Davom etish</button></main>`;
}

export function renderRules(ruleStates) {
  return ruleStates.map((r) => `<li class="${r.ok ? 'ok' : ''}">${r.ok ? '[x]' : '[ ]'} ${esc(r.label)}</li>`).join('');
}

export function renderRegisterForm({ values, errors, ruleStates, done }) {
  const v = (n) => esc(values[n] ?? '');
  const cls = (n) => (errors[n] ? 'invalid' : '');
  const input = (n, type = 'text') => `<input id="${n}" name="${n}" type="${type}" value="${type === 'password' ? '' : v(n)}" class="${cls(n)}" />`;
  return `<main><h1>Hisob yarating</h1>
    ${done ? `<p class="success" role="status">Hisob yaratildi. <a href="/login">Kirish</a></p>` : ''}
    <form id="register" class="card" novalidate>
      ${FIELD('Toʻliq ism', input('fullName'), errors, 'fullName')}
      ${FIELD('Email', input('email', 'email'), errors, 'email')}
      ${FIELD('Telefon', input('phone', 'tel'), errors, 'phone')}
      ${FIELD('Tugʻilgan sana', input('dob', 'date'), errors, 'dob')}
      ${FIELD('Parol', input('password', 'password'), errors, 'password')}
      <ul class="rules">${renderRules(ruleStates)}</ul>
      ${FIELD('Parolni tasdiqlang', input('confirmPassword', 'password'), errors, 'confirmPassword')}
      <button type="submit">Hisob yaratish</button> <a href="/login">Roʻyxatdan oʻtganmisiz? Kirish</a>
    </form></main>`;
}

export function renderLoginForm({ message, email = '' }) {
  return `<main><h1>Kirish</h1>${alertBox(message)}
    <form id="login" class="card" novalidate>
      <label>Email<input id="email" name="email" type="email" value="${esc(email)}" /></label>
      <label>Parol<input id="password" name="password" type="password" /></label>
      <button type="submit">Kirish</button> <a href="/register">Hisob yaratish</a>
    </form></main>`;
}

export function renderBookingSummary({ doctor, date, time, reason, error }) {
  return `<main><h1>Qabulingizni tasdiqlang</h1>${alertBox(error)}
    <div class="card"><dl>
      <dt>Shifokor</dt><dd>${esc(doctor.name)}, ${esc(doctor.specialty)}</dd>
      <dt>Sana</dt><dd>${esc(formatDateLong(date))}</dd>
      <dt>Vaqt</dt><dd>${esc(time)} (klinikaning mahalliy vaqti, UTC+5)</dd>
    </dl>
    <label>Sabab<textarea id="reason" rows="3">${esc(reason)}</textarea></label>
    <div class="row"><button class="secondary" data-action="back">Orqaga</button><button data-action="confirm-booking">Qabulni tasdiqlash</button></div></div></main>`;
}

export function renderConfirmation(booking) {
  return `<main><h1>Qabulingiz band qilindi</h1><div class="card">
    <p><strong>Qabul raqami: ${esc(booking.reference)}</strong></p>
    <p>${esc(booking.doctorName)}, ${esc(booking.specialty)}</p>
    <p>${esc(booking.confirmationDateText)}, ${esc(booking.time)}</p>
    <a class="button" href="/my-appointments">Mening qabullarimni koʻrish</a></div></main>`;
}

export function renderMyAppointments({ tab, data, error }) {
  const rows = (tab === 'upcoming' ? data.upcoming : data.past)
    .map(
      (a) => `<tr><td>${esc(a.dateLongText)}, ${esc(a.time)}</td><td>${esc(a.doctorName)}</td><td>${esc(a.reference)}</td>
        <td><span class="chip ${esc(a.status)}">${esc(statusLabel(a.status))}</span></td>
        <td>${tab === 'upcoming' && a.status === 'Booked' ? `<button class="secondary" data-action="reschedule" data-ref="${esc(a.reference)}">Boshqa vaqtga koʻchirish</button> <button class="secondary" data-action="cancel" data-ref="${esc(a.reference)}">Bekor qilish</button>` : ''}</td></tr>`,
    )
    .join('');
  const tabBtn = (id, label) => `<button class="${tab === id ? '' : 'secondary'}" data-action="tab" data-tab="${id}">${label}</button>`;
  return `<main><h1>Mening qabullarim</h1>${alertBox(error)}
    <div class="row">${tabBtn('upcoming', 'Kelgusi')}${tabBtn('past', 'Oʻtgan va bekor qilingan')}</div>
    <table><tbody>${rows || '<tr><td>Hozircha hech narsa yoʻq.</td></tr>'}</tbody></table></main>`;
}

export function renderCancelDialog(appointment) {
  return `<div class="dialog-backdrop"><div class="dialog" role="dialog" aria-modal="true">
    <h2>Bu qabulni bekor qilasizmi?</h2><p>${esc(appointment.dateLongText)}, ${esc(appointment.time)}, ${esc(appointment.doctorName)}</p>
    <div class="row"><button class="secondary" data-action="keep">Qabulni saqlash</button><button data-action="confirm-cancel" data-ref="${esc(appointment.reference)}">Ha, bekor qilish</button></div></div></div>`;
}
