/** Shared HTML helpers. Every view is a pure function returning a string. */
export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function fieldError(errors, name) {
  return errors?.[name] ? `<div class="field-error" data-error="${esc(name)}">${esc(errors[name])}</div>` : '';
}

export function alertBox(message) {
  return message ? `<div class="alert" role="alert">${esc(message)}</div>` : '';
}

export function renderPatientHeader({ patient, path }) {
  const link = (href, label) => `<a href="${href}" class="${path === href ? 'active' : ''}">${label}</a>`;
  return `<header class="site"><a class="brand" href="/doctors">ClinicBook</a>
    <nav>${link('/doctors', 'Shifokorlar')}${link('/my-appointments', 'Mening qabullarim')}</nav>
    ${patient ? `<span>${esc(patient.fullName)} <button class="secondary" data-action="patient-logout">Chiqish</button></span>` : `<a class="button" href="/login">Kirish</a>`}
  </header>`;
}
