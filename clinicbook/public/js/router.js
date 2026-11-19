/** Client routes. Pure, so the matching is tested without a browser. */
export const ROUTES = [
  { name: 'home', pattern: '/' },
  { name: 'doctors', pattern: '/doctors' },
  { name: 'doctor', pattern: '/doctors/:id' },
  { name: 'register', pattern: '/register' },
  { name: 'login', pattern: '/login' },
  { name: 'booking', pattern: '/book/confirm' },
  { name: 'my-appointments', pattern: '/my-appointments' },
  { name: 'admin-login', pattern: '/admin/login' },
  { name: 'admin-dashboard', pattern: '/admin/dashboard', resource: 'dashboard' },
  { name: 'admin-appointments', pattern: '/admin/appointments', resource: 'appointments' },
  { name: 'admin-my-schedule', pattern: '/admin/my-schedule', resource: 'my-schedule' },
  { name: 'admin-schedule', pattern: '/admin/schedules/:doctorId', resource: 'schedules' },
  { name: 'admin-patient', pattern: '/admin/patients/:id', resource: 'patients' },
  { name: 'admin-reports', pattern: '/admin/reports', resource: 'reports' },
];

export function matchRoute(path, routes = ROUTES) {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  for (const route of routes) {
    const names = [];
    const regex = new RegExp(`^${route.pattern.replace(/:([a-zA-Z]+)/g, (_, n) => (names.push(n), '([^/]+)'))}$`);
    const match = regex.exec(clean);
    if (match) return { ...route, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(match[i + 1])])) };
  }
  return null;
}
