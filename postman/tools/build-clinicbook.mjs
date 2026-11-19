#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collection, environment, folder, request, validateCollection } from './collection-kit.mjs';

/**
 * ClinicBook Postman collection. Texts are Uzbek (Latin script). The checks are basic on purpose:
 * status code, JSON type and the presence of key fields. Checking the acceptance criteria is the trainee's work,
 * so requests whose result depends on a business rule accept every plausible status code.
 */

const BASE_URL = 'http://localhost:3202';
const PATIENT_PASSWORD = '{{patientPassword}}';
const STAFF_PASSWORD = '{{staffPassword}}';
const unique = (prefix) => `${prefix}{{$timestamp}}{{$randomInt}}@example.com`;
const person = (over = {}) => ({
  fullName: 'Trainee Patient',
  email: '{{patientEmail}}',
  phone: '+1 555 010 4321',
  dob: '1991-02-03',
  password: PATIENT_PASSWORD,
  confirmPassword: PATIENT_PASSWORD,
  ...over,
});
const error = { error: 'string' };
const week = (start, end, startDay = 1, endDay = 5) =>
  Object.fromEntries(Array.from({ length: 7 }, (_, d) => [String(d), d >= startDay && d <= endDay ? { off: false, start, end } : { off: true }]));

const ac = (lines) => `Qabul mezonlari (Notion, Feature sahifasi):\n${lines.map((l, i) => `AC${i + 1}. ${l}`).join('\n')}`;
const task = (what, expected) => `Vazifa: ${what}\nKutilgan natija (qabul mezoni boʻyicha): ${expected}`;

const patientLogin = (name, email, password, description) =>
  request({
    name,
    method: 'POST',
    path: '/api/patient/login',
    body: { email, password },
    description,
    tests: { status: 200, fields: { patient: 'object' }, nested: { patient: { id: 'string', fullName: 'string' } } },
  });

const staffLogin = (name, email, description = task('Xodim sifatida tizimga kiring. Cookie Postman cookie jar da saqlanadi va keyingi soʻrovlarga avtomatik qoʻshiladi.', '200 va xodim roli hamda yoʻnaltirish manzili.')) =>
  request({
    name,
    method: 'POST',
    path: '/api/staff/login',
    body: { email, password: STAFF_PASSWORD },
    description,
    tests: { status: 200, fields: { redirect: 'string' }, nested: { user: { id: 'string', email: 'string', name: 'string', role: 'string' } } },
  });

// ---------------------------------------------------------------- folders
const c11 = folder(
  'C1.1 Doctor directory and filters',
  `${ac([
    'Shifokorlar roʻyxati: unvonli toʻliq ism, mutaxassislik, tajriba yillari va eng yaqin boʻsh sana.',
    'Mutaxassislik filtri roʻyxatni filtrlaydi (8 ta mutaxassislik).',
    'Ism boʻyicha qidiruv ismning bir qismi boʻyicha ishlaydi va harf registriga bogʻliq emas.',
    'Saralash: eng yaqin boʻsh vaqt (standart) va tajriba (koʻpdan kamga). Har biri butun roʻyxatni toʻgʻri saralaydi.',
    'Hech narsa topilmasa, roʻyxat boʻsh qaytadi (ekranda «Tanlangan filtrlar boʻyicha shifokor topilmadi» chiqadi).',
  ])}\n\nBu papkadagi soʻrovlar tizimga kirishni talab qilmaydi.`,
  [
    request({ name: 'GET /api/specialties - list specialties', path: '/api/specialties', description: task('Mutaxassisliklar roʻyxatini oling va sonini sanang.', '8 ta mutaxassislik.'), tests: { json: 'array' } }),
    request({
      name: 'GET /api/doctors - list doctors (default sort)',
      path: '/api/doctors',
      description: task('Barcha shifokorlarni oling. Har bir elementning maydonlarini koʻzdan kechiring.', 'Standart saralash: eng yaqin boʻsh sana, keyin ism boʻyicha. 12 ta shifokor.'),
      tests: { json: 'array', itemFields: { id: 'string', name: 'string', specialty: 'string', years: 'number', nextAvailable: 'string' } },
    }),
    request({ name: 'GET /api/doctors?specialty=Kardiologiya - filter by specialty', path: '/api/doctors', query: { specialty: 'Kardiologiya' }, description: task('Faqat bitta mutaxassislik boʻyicha filtrlang.', 'Faqat Kardiologiya shifokorlari.'), tests: { json: 'array', itemFields: { id: 'string', specialty: 'string' } } }),
    request({ name: 'GET /api/doctors?name=Rao - search by name (capital R)', path: '/api/doctors', query: { name: 'Rao' }, description: task('Ism boʻyicha qidiring.', 'Dr. A. Rao topiladi.'), tests: { json: 'array', itemFields: { name: 'string' } } }),
    request({ name: 'GET /api/doctors?name=rao - search by name (lower case)', path: '/api/doctors', query: { name: 'rao' }, description: task('Xuddi shu qidiruvni kichik harflar bilan takrorlang va natijani oldingisi bilan solishtiring.', 'Harf registri natijaga taʻsir qilmaydi (AC3).'), tests: { json: 'array' } }),
    request({ name: 'GET /api/doctors?sort=experience - sort by experience', path: '/api/doctors', query: { sort: 'experience' }, description: task('Tajriba boʻyicha saralang va years maydonlari tartibini tekshiring.', 'Tajriba koʻpdan kamga: 22, 18, 15, 14 ...'), tests: { json: 'array', itemFields: { years: 'number' } } }),
    request({ name: 'GET /api/doctors?specialty=Kardiologiya&name=zzz - no match', path: '/api/doctors', query: { specialty: 'Kardiologiya', name: 'zzz' }, description: task('Hech kimga mos kelmaydigan filtr yuboring.', 'Boʻsh roʻyxat.'), tests: { json: 'array' } }),
    request({ name: 'GET /api/doctors/:id - one doctor', path: '/api/doctors/{{doctorId}}', description: task('Bitta shifokorni id boʻyicha oling.', 'Shifokor maʻlumotlari.'), tests: { fields: { id: 'string', name: 'string', specialty: 'string', years: 'number' } } }),
    request({ name: 'GET /api/doctors/:id - unknown doctor', path: '/api/doctors/doctor-999', description: task('Mavjud boʻlmagan id yuboring.', 'Xato javobi va 404 holat kodi.'), tests: { status: 404, fields: error } }),
  ],
);

const c12 = folder(
  'C1.2 Appointment slot picker',
  `${ac([
    'Shifokor sahifasida bugundan boshlab 7 kunlik lenta; boʻsh vaqti yoʻq kun kulrang va bosib boʻlmaydi.',
    'Kun tanlanganda shifokorning ish vaqti ichidagi boʻsh 30 daqiqalik vaqtlar 24 soatlik formatda (09:30, 14:00) chiqadi.',
    'Band qilingan va oʻtib ketgan vaqtlar koʻrsatilmaydi.',
    'Bir vaqtda faqat bitta vaqtni tanlash mumkin (ekran qoidasi).',
    'Barcha vaqtlar klinikaning mahalliy vaqti boʻyicha (UTC+5).',
  ])}\n\nTest vaqti: 2026-11-19 13:10 (Facilitator tools papkasida koʻrinadi).`,
  [
    request({ name: 'GET /api/doctors/:id/week - 7-day strip', path: '/api/doctors/{{doctorId}}/week', description: task('Hafta lentasini oling va hasSlots qiymatlarini koʻring.', 'Bugundan boshlab 7 kun; boʻsh vaqti yoʻq kunlarda hasSlots = false (AC1).'), tests: { fields: { days: 'array' }, at: { '.days[0]': { date: 'string', weekday: 'string', day: 'number', hasSlots: 'boolean' } } } }),
    request({ name: 'GET /api/doctors/:id/slots - free slots on a weekday', path: '/api/doctors/{{doctorId}}/slots', query: { date: '2026-11-20' }, description: task('Ish kuni (juma) uchun vaqtlarni oling.', '30 daqiqalik vaqtlar, 24 soatlik format, ish vaqti ichida (AC2).'), tests: { fields: { date: 'string', times: 'array' } } }),
    request({ name: 'GET /api/doctors/:id/slots - Sunday (day off)', path: '/api/doctors/{{doctorId}}/slots', query: { date: '2026-11-22' }, description: task('Dam olish kuni uchun vaqtlarni soʻrang.', 'Boʻsh vaqt yoʻq (AC1).'), tests: { fields: { date: 'string', times: 'array' } } }),
    request({ name: 'GET /api/doctors/:id/slots - today', path: '/api/doctors/{{doctorId}}/slots', query: { date: '2026-11-19' }, description: task('Bugungi kun uchun vaqtlarni oling (test vaqti 13:10). Birinchi va band vaqtlarni (10:30) tekshiring.', 'Oʻtib ketgan va band vaqtlar roʻyxatda yoʻq (AC3).'), tests: { fields: { date: 'string', times: 'array' } } }),
    request({ name: 'GET /api/doctors/:id/slots - invalid date', path: '/api/doctors/{{doctorId}}/slots', query: { date: 'bad' }, description: task('Notoʻgʻri sana yuboring.', 'Xato javobi va 400 holat kodi.'), tests: { status: 400, fields: error } }),
    request({ name: 'GET /api/doctors/:id/slots - unknown doctor', path: '/api/doctors/doctor-999/slots', query: { date: '2026-11-20' }, description: task('Mavjud boʻlmagan shifokor uchun vaqtlarni soʻrang va holat kodini yozib oling.', 'Aniq holat kodi mezonlarda yozilmagan: oʻzingiz aniqlang va savol sifatida yozing.'), tests: { status: [200, 404] } }),
  ],
);

const c13 = folder(
  'C1.3 Patient registration and login',
  `${ac([
    'Roʻyxatdan oʻtish: toʻliq ism, email, telefon (10-12 raqam), tugʻilgan sana, parol, parolni tasdiqlash. Hammasi majburiy.',
    'Email toʻgʻri va yagona boʻlishi kerak. Yagonalik katta-kichik harfni hisobga olmaydi. Takror: «Bu email allaqachon roʻyxatdan oʻtgan».',
    'Parol kamida 8 belgi, 1 ta bosh harf va 1 ta raqam. Parollar mos kelmasa: «Parollar mos kelmadi».',
    'Tugʻilgan sana kelajakda boʻlmasligi kerak. 18 yoshga toʻlmagan bemor rad etiladi.',
    'Email va parol bilan kirish. 5 marta xato urinishdan keyin hisob 15 daqiqaga bloklanadi: «Urinishlar soni oshib ketdi. 15 daqiqadan keyin qayta urinib koʻring.»',
    'Parol maydonlarida koʻrsatish/yashirish belgisi (ekran qoidasi).',
  ])}\n\nPapka yuqoridan pastga ishga tushiriladi. Birinchi soʻrov patientEmail oʻzgaruvchisini yaratadi (pre-request script).`,
  [
    request({
      name: 'POST /api/patient/register - valid registration',
      method: 'POST',
      path: '/api/patient/register',
      body: person(),
      prerequest: ['pm.collectionVariables.set("patientEmail", "trainee" + Date.now() + "@example.com");'],
      description: task('Yangi bemorni roʻyxatdan oʻtkazing. Email har safar yangi yaratiladi.', '201 holat kodi, bemor id si qaytadi.'),
      tests: { status: 201, fields: { id: 'string', fullName: 'string', email: 'string' }, save: { patientId: 'id' } },
    }),
    request({ name: 'POST /api/patient/register - same email again', method: 'POST', path: '/api/patient/register', body: person(), description: task('Xuddi shu email bilan qayta roʻyxatdan oʻting.', '400 va «Bu email allaqachon roʻyxatdan oʻtgan» (AC2). Keyin email harflarini oʻzgartirib (katta/kichik) sinab koʻring.'), tests: { status: 400, fields: error } }),
    request({ name: 'POST /api/patient/register - empty body', method: 'POST', path: '/api/patient/register', body: {}, description: task('Boʻsh soʻrov yuboring va xato maydonlarini oʻqing.', '400 va barcha majburiy maydonlar uchun xabarlar (AC1).'), tests: { status: 400, fields: error } }),
    request({ name: 'POST /api/patient/register - short password', method: 'POST', path: '/api/patient/register', body: person({ email: unique('weak'), password: 'Abc123', confirmPassword: 'Abc123' }), description: task('6 belgili parol bilan urinib koʻring.', 'Parol kamida 8 belgi boʻlishi kerak (AC3). Natijani oʻzingiz baholang.'), tests: { status: [201, 400], fields: {} } }),
    request({ name: 'POST /api/patient/register - date of birth in the future', method: 'POST', path: '/api/patient/register', body: person({ email: unique('future'), dob: '2030-01-01' }), description: task('Kelajakdagi tugʻilgan sana yuboring.', '«Tugʻilgan sana kelajakda boʻlishi mumkin emas» (AC4). Natijani oʻzingiz baholang.'), tests: { status: [201, 400], fields: {} } }),
    request({ name: 'POST /api/patient/register - under 18', method: 'POST', path: '/api/patient/register', body: person({ email: unique('minor'), dob: '2012-05-05' }), description: task('18 yoshga toʻlmagan bemorni roʻyxatdan oʻtkazing.', '400 va «18 yoshga toʻlmagan bemorni ota-onasi yoki qonuniy vakili roʻyxatdan oʻtkazishi kerak» (AC4).'), tests: { status: 400, fields: error } }),
    request({ name: 'POST /api/patient/register - passwords do not match', method: 'POST', path: '/api/patient/register', body: person({ email: unique('mismatch'), confirmPassword: 'Different1' }), description: task('Tasdiqlash paroli boshqacha.', '400 va «Parollar mos kelmadi» (AC3).'), tests: { status: 400, fields: error } }),
    patientLogin('POST /api/patient/login - valid login', '{{patientEmail}}', PATIENT_PASSWORD, task('Yaratilgan bemor bilan kiring.', '200 va bemor maʻlumotlari; cookie oʻrnatiladi (AC5).')),
    request({ name: 'GET /api/patient/me - current patient', path: '/api/patient/me', description: task('Joriy bemorni soʻrang.', 'Kirgan bemor maʻlumotlari.'), tests: { fields: { patient: 'object' } } }),
    request({ name: 'POST /api/patient/login - wrong password', method: 'POST', path: '/api/patient/login', body: { email: '{{patientEmail}}', password: 'Wrong-value-1' }, description: task('Notoʻgʻri parol bilan kiring.', '401 va «Email yoki parol notoʻgʻri».'), tests: { status: 401, fields: error } }),
    request({ name: 'POST /api/patient/login - repeated wrong passwords (lockout)', method: 'POST', path: '/api/patient/login', body: { email: 'carlos.vega@example.com', password: 'Wrong-value-1' }, description: task('Bu soʻrovni Send tugmasi bilan 5, keyin 10 marta takrorlang (Carlos hisobi).', '5-urinishdan keyin 429 va «Urinishlar soni oshib ketdi...» (AC5). Qaysi urinishda bloklanishini yozib oling.'), tests: { status: [401, 429], fields: error } }),
    request({ name: 'POST /api/patient/logout - log out', method: 'POST', path: '/api/patient/logout', body: {}, description: task('Tizimdan chiqing.', '200, cookie oʻchiriladi.'), tests: { fields: { ok: 'boolean' } } }),
    request({ name: 'GET /api/patient/me - after logout', path: '/api/patient/me', description: task('Chiqqandan keyin joriy bemorni soʻrang.', 'Kirmagan foydalanuvchiga 401.'), tests: { status: 401, fields: error } }),
  ],
);

const c14 = folder(
  'C1.4 Booking confirmation and email',
  `${ac([
    'Xulosada shifokor, sana, vaqt va Sabab (majburiy, eng koʻpi 200 belgi). Boʻsh sabab: «Qabulga kelish sababini yozing».',
    'Tasdiqlash sahifasida CB- va 6 raqamdan iborat raqam hamda bemor tanlagan shifokor, sana va vaqt koʻrinadi.',
    '1 daqiqa ichida xat yuboriladi: raqam, shifokor, sana, vaqt, klinika manzili (12 Garden Street, Block B) va bekor qilish havolasi.',
    'Vaqt boshqa odam tomonidan band qilingan boʻlsa: «Bu vaqt endi band. Iltimos, boshqa vaqtni tanlang.»',
    'Bemor bir kunda bitta shifokorga ikki marta yozila olmaydi: «Siz bu kuni ushbu shifokorga allaqachon yozilgansiz».',
  ])}\n\nOldin C1.3 papkasini ishga tushiring (patientEmail kerak). Xatlar test muhitining ichki pochta qutisida (GET /api/dev/outbox) koʻrinadi.`,
  [
    patientLogin('POST /api/patient/login - log in as the trainee patient', '{{patientEmail}}', PATIENT_PASSWORD, task('C1.3 da yaratilgan bemor bilan kiring.', '200.')),
    request({
      name: 'POST /api/bookings - valid booking',
      method: 'POST',
      path: '/api/bookings',
      body: { doctorId: 'doctor-1', date: '2026-12-01', time: '09:00', reason: 'Yurak sohasida tekshiruv' },
      description: task('Dr. A. Rao ga 2026-12-01 kuni 09:00 ga yoziling. Javobdagi sana va vaqtni yuborganingiz bilan solishtiring.', '201, CB- bilan boshlanadigan raqam, sana va vaqt yuborilganiga teng (AC2).'),
      tests: { status: 201, fields: { reference: 'string' }, save: { bookingRef: 'reference' } },
    }),
    request({ name: 'POST /api/bookings - empty reason', method: 'POST', path: '/api/bookings', body: { doctorId: 'doctor-1', date: '2026-12-01', time: '10:00', reason: '' }, description: task('Sababsiz yoziling.', '400 va «Qabulga kelish sababini yozing» (AC1).'), tests: { status: [201, 400], fields: {} } }),
    request({ name: 'POST /api/bookings - slot already taken', method: 'POST', path: '/api/bookings', body: { doctorId: 'doctor-1', date: '2026-12-01', time: '09:00', reason: 'Takroriy urinish' }, description: task('Allaqachon band vaqtga yoziling.', '409 va «Bu vaqt endi band...» (AC4).'), tests: { status: 409, fields: error } }),
    request({ name: 'POST /api/bookings - same doctor, same day, other time', method: 'POST', path: '/api/bookings', body: { doctorId: 'doctor-1', date: '2026-12-01', time: '11:00', reason: 'Ikkinchi qabul' }, description: task('Shu shifokorga shu kunga boshqa vaqtga yoziling.', '409 va «Siz bu kuni ushbu shifokorga allaqachon yozilgansiz» (AC5).'), tests: { status: [201, 409], fields: {} } }),
    request({ name: 'POST /api/bookings - invalid time', method: 'POST', path: '/api/bookings', body: { doctorId: 'doctor-1', date: '2026-12-01', time: '25:99', reason: 'Xato vaqt' }, description: task('Mavjud boʻlmagan vaqt yuboring.', '400.'), tests: { status: 400, fields: error } }),
    request({ name: 'GET /api/appointments/mine - my appointments', path: '/api/appointments/mine', description: task('Oʻz qabullaringizni oling.', 'Kelgusi va oʻtgan qabullar.'), tests: { fields: { upcoming: 'array', past: 'array' } } }),
    request({ name: 'GET /api/dev/outbox - emails sent (test mailbox)', path: '/api/dev/outbox', description: task('Yuborilgan xatlarni oʻqing: mavzu, qabul raqami, shifokor, sana, vaqt, manzil va bekor qilish havolasi.', 'Xatda barcha maydonlar bor (AC3).'), tests: { json: 'array', itemFields: { to: 'string', subject: 'string', body: 'string' } } }),
    request({ name: 'POST /api/patient/logout - log out', method: 'POST', path: '/api/patient/logout', body: {}, description: task('Tizimdan chiqing.', '200.'), tests: { fields: { ok: 'boolean' } } }),
    request({ name: 'POST /api/bookings - without login', method: 'POST', path: '/api/bookings', body: { doctorId: 'doctor-1', date: '2026-12-02', time: '09:00', reason: 'Kirmasdan' }, description: task('Tizimga kirmasdan yoziling.', '401 va «Iltimos, tizimga kiring».'), tests: { status: 401, fields: error } }),
    patientLogin('POST /api/patient/login - log in again', '{{patientEmail}}', PATIENT_PASSWORD, task('Keyingi papkalar uchun qayta kiring.', '200.')),
  ],
);

const c15 = folder(
  'C1.5 Reschedule and cancel appointment',
  `${ac([
    'Mening qabullarim: kelgusi qabullar, har birida «Boshqa vaqtga koʻchirish» va «Bekor qilish».',
    'Bekor qilish tasdiq soʻraydi; faqat tasdiqdan keyin vaqt boʻshaydi (ekran qoidasi).',
    'Qabul boshlanishiga 24 soatdan kam qolganda bekor qilib boʻlmaydi: «Qabul boshlanishiga 24 soatdan kam qolganda uni bekor qilib boʻlmaydi.»',
    'Koʻchirishda eski vaqt yangi vaqt tasdiqlanmaguncha band qoladi.',
    'Bekor qilingan qabullar «Oʻtgan va bekor qilingan» boʻlimida koʻrinadi.',
  ])}\n\nDIQQAT: bu funksiya hali tayyor emas (Blocked): bekor qilish muddati (24 yoki 12 soat) Product Owner tomonidan hal qilinmagan. Natijalarni savol sifatida yozing.\n\nBu papka tayyor bemor Aminadan foydalanadi: parol xodimlar paroli bilan bir xil ({{staffPassword}}).`,
  [
    patientLogin('POST /api/patient/login - log in as Amina (seeded patient)', 'amina.patient@example.com', STAFF_PASSWORD, task('Tayyor bemor Amina bilan kiring.', '200.')),
    request({ name: 'GET /api/appointments/mine - Amina\'s appointments', path: '/api/appointments/mine', description: task('Aminaning qabullarini oling (CB-304511 va CB-304530 band).', 'Kelgusi va oʻtgan roʻyxatlar (AC1).'), tests: { fields: { upcoming: 'array', past: 'array' } } }),
    request({ name: 'POST /api/appointments/:ref/cancel - appointment today 12:00 (already started)', method: 'POST', path: '/api/appointments/CB-304530/cancel', body: {}, description: task('Bugungi 12:00 dagi qabulni bekor qiling (hozir 13:10).', 'Boshlanishiga 24 soatdan kam: rad etiladi (AC3). Natijani baholang.'), tests: { status: [200, 409], fields: {} } }),
    request({ name: 'POST /api/appointments/:ref/reschedule-start - start rescheduling', method: 'POST', path: '/api/appointments/CB-304511/reschedule-start', body: {}, description: task('CB-304511 ni koʻchirishni boshlang va keyin /mine orqali qabul holatini tekshiring.', 'Koʻchirish tasdiqlanmaguncha eski qabul band qoladi (AC4).'), tests: { fields: { doctorId: 'string', reference: 'string' } } }),
    request({ name: 'POST /api/appointments/:ref/reschedule - confirm new time', method: 'POST', path: '/api/appointments/CB-304511/reschedule', body: { date: '2026-11-24', time: '10:00' }, description: task('Yangi vaqtni tasdiqlang.', '200 va yangi sana/vaqt (AC4). Natijani oldingi soʻrovdan keyingi holat bilan solishtiring.'), tests: { status: [200, 409], fields: {} } }),
    request({ name: 'POST /api/appointments/:ref/cancel - appointment next week', method: 'POST', path: '/api/appointments/CB-304511/cancel', body: {}, description: task('Kelgusi hafta qabulini bekor qiling.', '200; qabul «Oʻtgan va bekor qilingan» ga oʻtadi (AC5).'), tests: { status: [200, 409], fields: {} } }),
    request({ name: 'POST /api/appointments/:ref/cancel - somebody else\'s appointment', method: 'POST', path: '/api/appointments/CB-304498/cancel', body: {}, description: task('Boshqa bemorning (Carlos) qabulini bekor qilishga urining.', '403 va «Bu sahifaga kirish huquqingiz yoʻq».'), tests: { status: 403, fields: error } }),
    request({ name: 'POST /api/appointments/:ref/cancel - unknown appointment', method: 'POST', path: '/api/appointments/CB-999999/cancel', body: {}, description: task('Mavjud boʻlmagan qabul raqamini yuboring.', '404.'), tests: { status: 404, fields: error } }),
  ],
);

const c21 = folder(
  'C2.1 Admin login with roles',
  `${ac([
    'Xodimlar kirishida notoʻgʻri parol ham, nomaʼlum email ham bir xil xabar beradi: «Email yoki parol notoʻgʻri».',
    'Rollar: Admin (hammasi), Receptionist (qabullar va bemor yozuvlari), Doctor (oʻz jadvali, oʻz qabullari, oʻz bemorlari).',
    'Kirgandan keyin: Admin /admin/dashboard, Receptionist /admin/appointments, Doctor /admin/my-schedule sahifasiga yoʻnaltiriladi.',
    'Rol uchun ruxsat etilmagan sahifa (hatto URL qoʻlda yozilsa ham) 403 beradi: «Bu sahifaga kirish huquqingiz yoʻq».',
    'Faolsizlikdan 30 daqiqa keyin seans tugaydi (soatni Facilitator tools orqali oldinga suring).',
    'Chiqqandan keyin himoyalangan sahifalar koʻrinmasligi kerak.',
  ])}\n\nXodimlar paroli: environment dagi staffPassword (tashkilotchi TRAINING_PASSWORD sifatida belgilagan).`,
  [
    request({ name: 'POST /api/staff/login - wrong password', method: 'POST', path: '/api/staff/login', body: { email: 'admin@clinicbook.test', password: 'Wrong-value-1' }, description: task('Mavjud email bilan notoʻgʻri parol yuboring.', '401 va «Email yoki parol notoʻgʻri» (AC1).'), tests: { status: 401, fields: error } }),
    request({ name: 'POST /api/staff/login - unknown email', method: 'POST', path: '/api/staff/login', body: { email: 'nobody@clinicbook.test', password: 'Wrong-value-1' }, description: task('Mavjud boʻlmagan email yuboring va xabar matnini oldingi soʻrov bilan solishtiring.', 'Xabarlar bir xil (AC1).'), tests: { status: 401, fields: error } }),
    staffLogin('POST /api/staff/login - admin', 'admin@clinicbook.test'),
    request({ name: 'GET /api/staff/me - current staff user', path: '/api/staff/me', description: task('Joriy xodimni soʻrang.', 'Admin roli.'), tests: { nested: { user: { id: 'string', role: 'string' } } } }),
    request({ name: 'POST /api/staff/logout - log out', method: 'POST', path: '/api/staff/logout', body: {}, description: task('Chiqing.', '200.'), tests: { fields: { ok: 'boolean' } } }),
    request({ name: 'GET /api/staff/me - after logout', path: '/api/staff/me', description: task('Chiqqandan keyin qayta soʻrang.', '401.'), tests: { status: 401, fields: error } }),
    staffLogin('POST /api/staff/login - receptionist', 'reception@clinicbook.test'),
    request({ name: 'GET /api/dashboard - as receptionist', path: '/api/dashboard', description: task('Qabulxona xodimi sifatida boshqaruv panelini soʻrang.', 'Receptionist boshqaruv paneliga kira olmaydi: 403 (AC4).'), tests: { status: [200, 403], fields: {} } }),
    staffLogin('POST /api/staff/login - doctor', 'doctor.rao@clinicbook.test'),
    request({ name: 'GET /api/dashboard - as doctor', path: '/api/dashboard', description: task('Shifokor sifatida boshqaruv panelini soʻrang.', '403 (AC4).'), tests: { status: [200, 403], fields: {} } }),
    staffLogin('POST /api/staff/login - admin again', 'admin@clinicbook.test'),
    request({ name: 'GET /api/dashboard - as admin', path: '/api/dashboard', description: task('Administrator sifatida boshqaruv panelini oling.', '200 va 4 ta koʻrsatkich.'), tests: { fields: { appointmentsToday: 'number', upcomingAppointments: 'number', doctors: 'number', patients: 'number' } } }),
  ],
);

const doctorSchedule = (id) => ({ slotMinutes: 30, days: id === 'doctor-3' ? week('09:00', '15:00', 2, 6) : id === 'doctor-2' ? week('10:00', '18:00') : week('09:00', '17:00') });

const c22 = folder(
  'C2.2 Doctor weekly schedule management',
  `${ac([
    'Haftalik jadval: Dushanbadan Yakshanbagacha Dam olish kuni, Boshlanishi, Tugashi va qabul davomiyligi (15, 30 yoki 45 daqiqa).',
    'Kun yoki dam olish kuni, yoki boshlanish va tugash vaqti bor.',
    'Tugash vaqti boshlanishdan keyin boʻlishi kerak («Tugash vaqti boshlanish vaqtidan keyin boʻlishi kerak»); teng vaqtlar mumkin emas. Saqlash: «Jadval saqlandi».',
    'Yangi soatlar band qilingan qabullarni ish vaqtidan tashqarida qoldirsa, ogohlantirish chiqadi va qabullar oʻchirilmaydi.',
    'Admin istalgan shifokorni tahrirlay oladi. Shifokor faqat oʻz jadvalini tahrirlaydi (URL oʻzgartirilsa ham).',
  ])}`,
  [
    staffLogin('POST /api/staff/login - admin', 'admin@clinicbook.test'),
    request({ name: 'GET /api/schedules/:doctorId - read a schedule', path: '/api/schedules/doctor-3', description: task('Dr. S. Roy jadvalini oling.', 'Jadval, shifokorlar roʻyxati va shifokor qabullari (AC1).'), tests: { fields: { doctor: 'object', doctors: 'array', schedule: 'object', appointments: 'array' } } }),
    request({ name: 'PUT /api/schedules/:doctorId - save the same hours', method: 'PUT', path: '/api/schedules/doctor-3', body: doctorSchedule('doctor-3'), description: task('Jadvalni oʻzgartirmasdan saqlang.', '200 (AC3).'), tests: { fields: { schedule: 'object' } } }),
    request({ name: 'PUT /api/schedules/:doctorId - end before start', method: 'PUT', path: '/api/schedules/doctor-3', body: { slotMinutes: 30, days: { ...doctorSchedule('doctor-3').days, 2: { off: false, start: '15:00', end: '09:00' } } }, description: task('Tugash vaqtini boshlanishdan oldinga qoʻying.', '400 va «Tugash vaqti boshlanish vaqtidan keyin boʻlishi kerak» (AC3).'), tests: { status: 400, fields: error } }),
    request({ name: 'PUT /api/schedules/:doctorId - end equal to start', method: 'PUT', path: '/api/schedules/doctor-3', body: { slotMinutes: 30, days: { ...doctorSchedule('doctor-3').days, 2: { off: false, start: '09:00', end: '09:00' } } }, description: task('Boshlanish va tugash vaqtini bir xil qiling.', 'Teng vaqtlar mumkin emas (AC3). Natijani baholang.'), tests: { status: [200, 400, 409], fields: {} } }),
    request({ name: 'PUT /api/schedules/:doctorId - shorten hours with booked appointments', method: 'PUT', path: '/api/schedules/doctor-1', body: { slotMinutes: 30, days: { ...doctorSchedule('doctor-1').days, 1: { off: false, start: '09:00', end: '09:30' } } }, description: task('Dr. A. Rao dushanba ish vaqtini 09:00-09:30 ga qisqartiring (dushanba 10:00 da band qabul bor). Keyin GET /api/schedules/doctor-1 bilan qabullarni tekshiring.', 'Ogohlantirish (409, qabullar roʻyxati bilan); qabullar oʻchmaydi va yashirilmaydi (AC4).'), tests: { status: [200, 409], fields: {} } }),
    request({ name: 'GET /api/schedules/:doctorId - appointments after the change', path: '/api/schedules/doctor-1', description: task('Oldingi soʻrovdan keyin Dr. Rao qabullari roʻyxatini tekshiring.', 'Band qabullar yoʻqolmagan (AC4).'), tests: { fields: { appointments: 'array' } } }),
    staffLogin('POST /api/staff/login - doctor (Dr. Rao)', 'doctor.rao@clinicbook.test'),
    request({ name: 'PUT /api/schedules/:doctorId - doctor edits another doctor', method: 'PUT', path: '/api/schedules/doctor-2', body: doctorSchedule('doctor-2'), description: task('Dr. Rao sifatida Dr. L. Kim jadvalini saqlang (URL dagi id boshqa shifokorniki).', '403 (AC5).'), tests: { status: [200, 403], fields: {} } }),
    staffLogin('POST /api/staff/login - receptionist', 'reception@clinicbook.test'),
    request({ name: 'GET /api/schedules/:doctorId - as receptionist', path: '/api/schedules/doctor-1', description: task('Qabulxona xodimi sifatida jadvalni oching.', 'Rol jadvallarga kira olmaydi (AC5, rollar jadvali).'), tests: { status: [200, 403], fields: {} } }),
  ],
);

const adminList = (name, query, description) =>
  request({
    name,
    path: '/api/admin/appointments',
    query,
    description,
    tests: {
      fields: { rows: 'array', total: 'number', page: 'number', pageSize: 'number', lastPage: 'number', counter: 'string' },
      at: { '.rows[0]': { reference: 'string', patient: 'string', doctor: 'string', date: 'string', time: 'string', status: 'string' } },
    },
  });

const c23 = folder(
  'C2.3 Appointments list with filters',
  `${ac([
    'Jadval ustunlari ketma-ketligi: Raqam, Bemor, Shifokor, Sana, Vaqt, Holat.',
    'Filtrlar: sana oraligʻi (ikkala chegara kiradi), shifokor, holat. Standart oraliq: bugundan bugungacha.',
    'Standart saralash: sana, keyin vaqt, eng erta birinchi. Sarlavhani bosish shu ustun boʻyicha saralaydi; sanalar xronologik saralanadi.',
    'Sahifada 20 qator. Hisoblagich jami mos qatorlar sonini koʻrsatadi: «57 tadan 1-20 koʻrsatilmoqda».',
    'Qabulxona xodimi va Admin holatni oʻzgartira oladi; Shifokor faqat oʻz qabullarini koʻradi (bu qism hali tayyor emas).',
  ])}\n\nParametrlar: from, to (YYYY-MM-DD), doctorId, status (Booked, Completed, Cancelled, No-show), sort (reference, patient, doctor, date, time, status), dir (asc, desc), page.`,
  [
    staffLogin('POST /api/staff/login - admin', 'admin@clinicbook.test'),
    adminList('GET /api/admin/appointments - default list', {}, task('Parametrsiz roʻyxatni oling. total, pageSize va counter ni solishtiring.', 'Standart oraliq bugun; counter jami sonni koʻrsatadi (AC2, AC4).')),
    adminList('GET /api/admin/appointments?from&to - date range', { from: '2026-11-19', to: '2026-11-20' }, task('19 va 20 noyabr oraligʻini soʻrang. Qaysi sanalar qaytganini koʻring.', 'Ikkala chegara ham kiradi (AC2).')),
    adminList('GET /api/admin/appointments?doctorId - by doctor', { doctorId: 'doctor-1' }, task('Bitta shifokor boʻyicha filtrlang.', 'Faqat shu shifokor qabullari.')),
    adminList('GET /api/admin/appointments?status - by status', { status: 'Booked' }, task('Holat boʻyicha filtrlang.', 'Faqat Booked qatorlari.')),
    adminList('GET /api/admin/appointments?sort=date - sorted by date', { sort: 'date', dir: 'asc' }, task('Sana boʻyicha oʻsish tartibida saralang va tartibni tekshiring (oy nomlari, 05 Dek 2026 va 12 Noy 2026).', 'Xronologik tartib (AC3).')),
    adminList('GET /api/admin/appointments?page=2 - second page', { page: '2' }, task('Ikkinchi sahifani oling va counter ni oʻqing.', '«57 tadan 21-40 koʻrsatilmoqda» (AC4).')),
    adminList('GET /api/admin/appointments?page=99 - page out of range', { page: '99' }, task('Mavjud boʻlmagan sahifani soʻrang.', 'Server oxirgi sahifani qaytaradi.')),
  ],
);

const c24 = folder(
  'C2.4 Patient record view',
  `${ac([
    'Bemor yozuvi: toʻliq ism, tugʻilgan sana, yosh, telefon, email va tashriflar tarixi.',
    'Shifokor roli telefonni yashirin koʻradi (+1 *** *** 1234, faqat oxirgi 4 raqam). Qabulxona xodimi va Admin toʻliq raqamni koʻradi.',
    'Yosh toʻliq yillar soni (yuqoriga yaxlitlanmaydi).',
    'Tashriflar tarixi: yangilari birinchi, eng koʻpi 10 qator va «Barcha tashriflarni koʻrsatish» havolasi (?all=1).',
    'Tashrifi yoʻq bemor: «Hali tashriflar yoʻq» (bu holda visits boʻsh).',
    'Shifokor faqat oʻzi bilan qabuli boʻlgan bemorlarni ochadi; boshqalarda 403 (URL qoʻlda yozilsa ham).',
  ])}\n\nBemorlar: patient-1 Amina (12 tashrif), patient-2 Bilal (tashrifi yoʻq, Dr. Rao bilan qabuli yoʻq).`,
  [
    staffLogin('POST /api/staff/login - admin', 'admin@clinicbook.test'),
    request({ name: 'GET /api/patients/:id - Amina', path: '/api/patients/patient-1', description: task('Amina yozuvini oching. Yosh va tashriflar tartibini tekshiring (tugʻilgan sana 14 Mar 1990, bugun 19 Noy 2026).', 'Yosh 36; tashriflar yangilari birinchi (AC3, AC4).'), tests: { fields: { id: 'string', fullName: 'string', dob: 'string', age: 'number', phone: 'string', email: 'string', visits: 'array' } } }),
    request({ name: 'GET /api/patients/:id?all=1 - all visits', path: '/api/patients/patient-1', query: { all: '1' }, description: task('Barcha tashriflarni soʻrang va qatorlar sonini oddiy soʻrov bilan solishtiring.', 'Oddiy soʻrovda eng koʻpi 10, ?all=1 da barchasi (12) (AC4).'), tests: { fields: { visits: 'array', hasMore: 'boolean' } } }),
    request({ name: 'GET /api/patients/:id - patient without visits', path: '/api/patients/patient-2', description: task('Tashrifi yoʻq bemorni oching.', 'visits boʻsh (AC5).'), tests: { fields: { id: 'string', visits: 'array' } } }),
    request({ name: 'GET /api/patients/:id - unknown patient', path: '/api/patients/patient-999', description: task('Mavjud boʻlmagan bemor.', '404.'), tests: { status: 404, fields: error } }),
    staffLogin('POST /api/staff/login - doctor (Dr. Rao)', 'doctor.rao@clinicbook.test'),
    request({ name: 'GET /api/patients/:id - own patient as doctor (phone masking)', path: '/api/patients/patient-1', description: task('Dr. Rao sifatida oʻz bemori Aminani oching va telefon maydonini oʻqing.', 'Telefon yashirin: +1 *** *** 1234 (AC2).'), tests: { fields: { phone: 'string' } } }),
    request({ name: 'GET /api/patients/:id - other doctor\'s patient', path: '/api/patients/patient-2', description: task('Dr. Rao sifatida u bilan qabuli boʻlmagan Bilalni oching.', '403 (AC6).'), tests: { status: [200, 403], fields: {} } }),
  ],
);

const c25 = folder(
  'C2.5 Daily report export',
  `${ac([
    'Hisobotlar sahifasi (faqat Admin): sana tanlash, format (CSV yoki PDF) va Eksport tugmasi.',
    'Ustunlar: Vaqt, Bemor, Shifokor, Holat. Birinchi qator: klinika nomi va sana. Vergul bor qiymatlar CSV da qoʻsh tirnoqqa olinadi.',
    'Qabullari yoʻq kun ham sarlavha va «Qabullar yoʻq» qatori bilan fayl beradi.',
    'Fayl nomi: appointments-YYYY-MM-DD.csv (masalan appointments-2026-11-19.csv).',
    '500 qatorgacha 10 soniyadan kam vaqtda eksport qilinadi.',
    'Hisobotlar menyusi va Eksport tugmasi faqat Adminga koʻrinadi.',
  ])}\n\nDIQQAT: PDF hali tayyor emas (Blocked): kutubxona litsenziyasi tasdiqlanmagan. Faqat CSV mavjud. Fayl nomini javob sarlavhasidagi Content-Disposition dan oʻqing (Postman: Headers yorligʻi).`,
  [
    staffLogin('POST /api/staff/login - admin', 'admin@clinicbook.test'),
    request({ name: 'GET /api/reports/daily - CSV of 19 Nov', path: '/api/reports/daily', query: { date: '2026-11-19', format: 'csv' }, description: task('19-noyabr hisobotini oling. Birinchi qatorlarni, vergulli ismni (Patient, Amina) va fayl nomini tekshiring.', 'Fayl nomi appointments-2026-11-19.csv; vergulli qiymatlar tirnoqda (AC2, AC4).'), tests: { json: false, contentType: 'text/csv' } }),
    request({ name: 'GET /api/reports/daily - day without appointments', path: '/api/reports/daily', query: { date: '2026-11-21', format: 'csv' }, description: task('Qabuli yoʻq kun (shanba) uchun hisobot oling.', 'Sarlavha va «Qabullar yoʻq» qatori (AC3).'), tests: { json: false, contentType: 'text/csv' } }),
    request({ name: 'GET /api/reports/daily - PDF format', path: '/api/reports/daily', query: { date: '2026-11-19', format: 'pdf' }, description: task('PDF soʻrang.', 'Hali tayyor emas: 400 va «PDF eksporti tez orada qoʻshiladi».'), tests: { status: 400, fields: error } }),
    request({ name: 'GET /api/reports/daily - invalid date', path: '/api/reports/daily', query: { date: 'bad', format: 'csv' }, description: task('Notoʻgʻri sana yuboring.', '400.'), tests: { status: 400, fields: error } }),
    staffLogin('POST /api/staff/login - receptionist', 'reception@clinicbook.test'),
    request({ name: 'GET /api/reports/daily - as receptionist', path: '/api/reports/daily', query: { date: '2026-11-19', format: 'csv' }, description: task('Qabulxona xodimi sifatida hisobotni soʻrang.', 'Faqat Admin uchun: 403 (AC6).'), tests: { status: [200, 403], json: false } }),
  ],
);

const tools = folder(
  'Facilitator tools',
  'Tashkilotchi uchun yordamchi soʻrovlar: soat, maʼlumotlarni qayta tiklash, saqlash holati. DIQQAT: GET /api/config qaysi nuqsonlar yoqilganini koʻrsatadi (javoblar kaliti). Mashq tugamaguncha oʻquvchilarga koʻrsatmang.',
  [
    request({ name: 'GET /api/config - active defects (SPOILER)', path: '/api/config', description: 'Qaysi nuqsonlar yoqilgan va test soati. Oʻquvchilarga javoblar kalitini koʻrsatadi.', tests: { fields: { defects: 'object', now: 'string' } } }),
    request({ name: 'GET /api/dev/clock - read the test clock', path: '/api/dev/clock', description: 'Test soatini oʻqing (standart 2026-11-19 13:10).', tests: { fields: { now: 'string', today: 'string', time: 'string' } } }),
    request({ name: 'POST /api/dev/clock - advance by 30 minutes', method: 'POST', path: '/api/dev/clock', body: { advanceMinutes: 30 }, description: 'Soatni 30 daqiqaga oldinga suring (seans muddati va bekor qilish qoidalarini sinash uchun).', tests: { fields: { now: 'string' } } }),
    request({ name: 'POST /api/dev/clock - set the clock back to 13:10', method: 'POST', path: '/api/dev/clock', body: { now: '2026-11-19T13:10' }, description: 'Soatni boshlangʻich vaqtga qaytaring. C1.5 va boshqa mashqlar uchun 10:00 qoʻyish ham mumkin.', tests: { fields: { now: 'string' } } }),
    request({ name: 'GET /api/dev/storage - storage status', path: '/api/dev/storage', description: 'Maʼlumotlar qayerda saqlanadi (memory yoki notion), navbatdagi yozuvlar soni va oxirgi xato.', tests: { fields: { mode: 'string', pending: 'number', lastError: undefined, lastSyncAt: undefined } } }),
    request({ name: 'GET /api/dev/outbox - emails (JSON)', path: '/api/dev/outbox', description: 'Yuborilgan xatlar roʻyxati (JSON).', tests: { json: 'array' } }),
    request({ name: 'GET /dev/outbox - emails (HTML page)', path: '/dev/outbox', description: 'Ichki pochta qutisi sahifasi (brauzer uchun).', tests: { json: false, contentType: 'text/html' } }),
    request({ name: 'POST /api/dev/reset - reset all data', method: 'POST', path: '/api/dev/reset', body: {}, description: 'DIQQAT: barcha maʼlumotlarni boshlangʻich holatga qaytaradi (Notion yozuvlari ham navbat boʻyicha tiklanadi). Umumiy serverda boshqa oʻquvchilarning maʼlumotlari ham oʻchadi.', tests: { fields: { ok: 'boolean' } } }),
  ],
);

const DESCRIPTION = `ClinicBook API (Uzbek, Latin script): bemorlar portali va xodimlar paneli.

Qanday ishlatiladi
1. Environment "ClinicBook local" ni tanlang. baseUrl standart http://localhost:3202. staffPassword maydoniga tashkilotchi bergan umumiy parolni oʻzingiz kiriting (u fayllarda saqlanmaydi).
2. Papkalar Notion dagi Feature lar bilan bir xil nomlangan (C1.1 ... C2.5). Har bir papkani yuqoridan pastga ishga tushiring (Run folder). Tizimga kirish soʻrovlari papkalar ichida bor.
3. Cookie lar Postman ning cookie jar ida avtomatik saqlanadi: bemor cookie si (cb_patient) va xodim cookie si (cb_staff) alohida.
4. Xatolar JSON koʻrinishida: { "error": "matn", "fields": { ... } }. Holat kodlari: 400 tekshiruv xatosi, 401 kirilmagan, 403 ruxsat yoʻq, 404 topilmadi, 409 ziddiyat, 429 juda koʻp urinish.
5. Har bir soʻrovda faqat asosiy tekshiruvlar bor (holat kodi, JSON turi, asosiy maydonlar). Qabul mezonlarini tekshirish va yangi pm.test lar yozish sizning vazifangiz. Natija mezonga mos kelmasa, bu nuqson: Notion da Bug yarating (Parent = shu Feature).
6. Kutilgan natija mezonga bogʻliq boʻlgan soʻrovlarda barcha mumkin boʻlgan holat kodlari qabul qilinadi; haqiqiy kutilgan kodni soʻrov tavsifidan oʻqing.

Test maʼlumotlari
- Shifokorlar doctor-1 ... doctor-12; bemorlar patient-1 ... patient-8 (Amina: amina.patient@example.com).
- Xodimlar: admin@clinicbook.test, reception@clinicbook.test, doctor.rao@clinicbook.test (parol: staffPassword).
- Test vaqti: 2026-11-19 13:10.
- Qaytadan boshlash uchun: Facilitator tools / POST /api/dev/reset.`;

export function buildClinicBook() {
  const items = [c11, c12, c13, c14, c15, c21, c22, c23, c24, c25, tools];
  const col = collection({
    name: 'ClinicBook API',
    description: DESCRIPTION,
    items,
    variables: [
      { key: 'baseUrl', value: BASE_URL, description: 'ClinicBook serveri manzili' },
      { key: 'doctorId', value: 'doctor-1', description: 'Shifokor id si (Dr. A. Rao)' },
      { key: 'patientEmail', value: '', description: 'C1.3 birinchi soʻrovi har safar yangi email yaratadi' },
      { key: 'patientPassword', value: 'Abcdef12', description: 'Test bemorining namunaviy paroli (haqiqiy hisob emas)' },
      { key: 'patientId', value: '', description: 'Yaratilgan bemor id si' },
      { key: 'bookingRef', value: '', description: 'Oxirgi qabul raqami' },
    ],
  });
  const env = environment({
    name: 'ClinicBook local',
    values: [
      { key: 'baseUrl', value: BASE_URL },
      { key: 'staffPassword', value: '', type: 'secret' },
    ],
  });
  return { collection: col, environment: env };
}

function main() {
  const { collection: col, environment: env } = buildClinicBook();
  const problems = validateCollection(col);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  const out = join(dirname(fileURLToPath(import.meta.url)), '..');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'ClinicBook.postman_collection.json'), `${JSON.stringify(col, null, 2)}\n`);
  writeFileSync(join(out, 'ClinicBook.postman_environment.json'), `${JSON.stringify(env, null, 2)}\n`);
  console.log('Wrote ClinicBook.postman_collection.json and ClinicBook.postman_environment.json');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
