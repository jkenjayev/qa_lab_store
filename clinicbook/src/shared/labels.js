/**
 * Display labels (Uzbek) for data values that logic and CSS depend on.
 * The stored codes stay as they are (API values, CSS classes, access rules); only what a person reads changes.
 */
export const STATUS_LABEL = Object.freeze({
  Booked: 'Band qilingan',
  Completed: 'Yakunlangan',
  Cancelled: 'Bekor qilingan',
  'No-show': 'Kelmadi',
});

export const ROLE_LABEL = Object.freeze({
  Admin: 'Administrator',
  Receptionist: 'Qabulxona xodimi',
  Doctor: 'Shifokor',
});

/** Index 0 = Sunday. Also the keys of the schedule validation errors. */
export const DAY_LABEL = Object.freeze(['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']);

export const statusLabel = (status) => STATUS_LABEL[status] ?? status;
export const roleLabel = (role) => ROLE_LABEL[role] ?? role;
