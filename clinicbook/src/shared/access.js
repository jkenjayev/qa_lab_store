/** Role access matrix shared by the API (enforcement) and the browser (menus and route guards). */
export const ROLES = Object.freeze(['Admin', 'Receptionist', 'Doctor']);

const START_PAGE = Object.freeze({
  Admin: '/admin/dashboard',
  Receptionist: '/admin/appointments',
  Doctor: '/admin/my-schedule',
});
export const startPage = (role) => START_PAGE[role] ?? '/admin/login';

/**
 * @param {string} role
 * @param {'dashboard'|'appointments'|'my-schedule'|'schedules'|'patients'|'reports'} resource
 */
export function canAccess(role, resource, defects) {
  switch (resource) {
    case 'dashboard':
      // CB_RECEPTION_OPENS_DASHBOARD (Receptionist can open the Admin dashboard by URL)
      return role === 'Admin' || (role === 'Receptionist' && Boolean(defects.CB_RECEPTION_OPENS_DASHBOARD));
    case 'appointments':
    case 'patients':
      return ROLES.includes(role);
    case 'my-schedule':
      return role === 'Doctor';
    case 'schedules':
      return role === 'Admin' || role === 'Doctor';
    case 'reports':
      // CB_RECEPTION_SEES_EXPORT (Receptionist can see Reports and Export)
      return role === 'Admin' || (role === 'Receptionist' && Boolean(defects.CB_RECEPTION_SEES_EXPORT));
    default:
      return false;
  }
}

const MENU = [
  { label: 'Boshqaruv paneli', href: '/admin/dashboard', resource: 'dashboard' },
  { label: 'Qabullar', href: '/admin/appointments', resource: 'appointments' },
  { label: 'Mening jadvalim', href: '/admin/my-schedule', resource: 'my-schedule' },
  { label: 'Jadvallar', href: '/admin/schedules/doctor-1', resource: 'schedules' },
  { label: 'Hisobotlar', href: '/admin/reports', resource: 'reports' },
];

/** Menu entries a role may open. The dashboard defect only works by URL, never through the menu. */
export function menuFor(role, defects) {
  const menuDefects = { ...defects, CB_RECEPTION_OPENS_DASHBOARD: false };
  return MENU.filter((item) => {
    if (item.resource === 'schedules' && role === 'Doctor') return false; // doctors use My schedule
    return canAccess(role, item.resource, menuDefects);
  });
}
