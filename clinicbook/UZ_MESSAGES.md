# ClinicBook: English -> Uzbek (Latin script)

The app shows Uzbek only. Use these exact texts when the Notion acceptance criteria and designs quote the app.
Internal codes stay English on purpose (API values, CSS classes, role rules): statuses `Booked`, `Completed`,
`Cancelled`, `No-show` and roles `Admin`, `Receptionist`, `Doctor`. Only their display labels are Uzbek (tables below).
Apostrophe letters use the modifier letter ʻ (U+02BB): oʻ, gʻ.

## Messages (src/shared/messages.js)
| English | Uzbek |
|---|---|
| Invalid email or password | Email yoki parol notoʻgʻri |
| Email not found | Bunday email topilmadi |
| Too many attempts. Try again in 15 minutes. | Urinishlar soni oshib ketdi. 15 daqiqadan keyin qayta urinib koʻring. |
| Session expired. Please sign in again. | Seans muddati tugadi. Iltimos, qaytadan kiring. |
| Please sign in | Iltimos, tizimga kiring |
| You do not have access to this page | Bu sahifaga kirish huquqingiz yoʻq |
| This slot is no longer available. Please choose another. | Bu vaqt endi band. Iltimos, boshqa vaqtni tanlang. |
| Tell us the reason for your visit | Qabulga kelish sababini yozing |
| Reason must be 200 characters or fewer | Sabab 200 belgidan oshmasligi kerak |
| You already have an appointment with this doctor on this day | Siz bu kuni ushbu shifokorga allaqachon yozilgansiz |
| Appointments cannot be cancelled less than 24 hours before the start. | Qabul boshlanishiga 24 soatdan kam qolganda uni bekor qilib boʻlmaydi. |
| End time must be after start time | Tugash vaqti boshlanish vaqtidan keyin boʻlishi kerak |
| Schedule saved | Jadval saqlandi |
| Some booked appointments would fall outside the new working hours | Band qilingan ayrim qabullar yangi ish vaqtidan tashqarida qoladi |
| No doctors found for your filters | Tanlangan filtrlar boʻyicha shifokor topilmadi |
| No visits yet | Hali tashriflar yoʻq |
| No appointments | Qabullar yoʻq |
| This email is already registered | Bu email allaqachon roʻyxatdan oʻtgan |
| Enter your full name | Toʻliq ismingizni kiriting |
| Enter a valid email | Toʻgʻri email kiriting |
| Enter a valid phone number | Toʻgʻri telefon raqamini kiriting |
| Enter your date of birth | Tugʻilgan sanangizni kiriting |
| Date of birth cannot be in the future | Tugʻilgan sana kelajakda boʻlishi mumkin emas |
| Patients under 18 must be registered by a parent or guardian | 18 yoshga toʻlmagan bemorni ota-onasi yoki qonuniy vakili roʻyxatdan oʻtkazishi kerak |
| Password does not meet the rules | Parol qoidalarga mos kelmaydi |
| Passwords do not match | Parollar mos kelmadi |
| All times are clinic local time (UTC+5) | Barcha vaqtlar klinikaning mahalliy vaqti boʻyicha (UTC+5) |
| 12 Garden Street, Block B (clinic address) | 12 Garden Street, Block B (oʻzgarmaydi) |

## Password rules (shown live)
| English | Uzbek |
|---|---|
| 8 or more characters | 8 yoki undan ortiq belgi |
| 1 uppercase letter | 1 ta bosh harf |
| 1 digit | 1 ta raqam |

## Patient portal
| English | Uzbek |
|---|---|
| Doctors (menu) | Shifokorlar |
| My appointments (menu, page title) | Mening qabullarim |
| Log in / Log out | Kirish / Chiqish |
| Find a doctor | Shifokorni toping |
| Search (name box), placeholder name... | Qidirish, ism... |
| Specialty | Mutaxassislik |
| All specialties | Barcha mutaxassisliklar |
| Sort | Saralash |
| Next available | Eng yaqin boʻsh vaqt |
| Experience (high to low) | Tajriba (koʻpdan kamga) |
| Reset filters | Filtrlarni tozalash |
| 14 years | 14 yil tajriba |
| Next: 20 Nov 2026 | Eng yaqin vaqt: 20 Noy 2026 |
| View slots | Vaqtlarni koʻrish |
| Free slots on Fri 20 Nov 2026 | Ju 20 Noy 2026 kuni boʻsh vaqtlar |
| Choose a new time for appointment CB-304517. | CB-304517 raqamli qabul uchun yangi vaqtni tanlang. |
| Continue | Davom etish |
| Create your account | Hisob yarating |
| Account created. Log in | Hisob yaratildi. Kirish |
| Full name / Email / Phone | Toʻliq ism / Email / Telefon |
| Date of birth | Tugʻilgan sana |
| Password / Confirm password | Parol / Parolni tasdiqlang |
| Create account | Hisob yaratish |
| Already registered? Log in | Roʻyxatdan oʻtganmisiz? Kirish |
| Create an account | Hisob yaratish |
| Confirm your appointment | Qabulingizni tasdiqlang |
| Doctor / Date / Time / Reason | Shifokor / Sana / Vaqt / Sabab |
| 10:30 (clinic local time, UTC+5) | 10:30 (klinikaning mahalliy vaqti, UTC+5) |
| Back | Orqaga |
| Confirm booking | Qabulni tasdiqlash |
| Your appointment is booked | Qabulingiz band qilindi |
| Reference: CB-304517 | Qabul raqami: CB-304517 |
| View my appointments | Mening qabullarimni koʻrish |
| Upcoming (tab) | Kelgusi |
| Past and cancelled (tab) | Oʻtgan va bekor qilingan |
| Nothing here yet. | Hozircha hech narsa yoʻq. |
| Reschedule | Boshqa vaqtga koʻchirish |
| Cancel | Bekor qilish |
| Cancel this appointment? | Bu qabulni bekor qilasizmi? |
| Keep appointment | Qabulni saqlash |
| Yes, cancel | Ha, bekor qilish |
| Appointment rescheduled (toast) | Qabul boshqa vaqtga koʻchirildi |

## Back office
| English | Uzbek |
|---|---|
| ClinicBook staff | ClinicBook xodimlari |
| Sign in | Kirish |
| 403 / Go to my start page | 403 / Bosh sahifamga oʻtish |
| Dashboard (menu, title) | Boshqaruv paneli |
| Appointments (menu, title) | Qabullar |
| My schedule (menu) | Mening jadvalim |
| Schedules (menu) | Jadvallar |
| Reports (menu) | Hisobotlar |
| Appointments today / Upcoming appointments / Doctors / Patients (dashboard) | Bugungi qabullar / Kelgusi qabullar / Shifokorlar / Bemorlar |
| Reference / Patient / Doctor / Date / Time / Status (columns) | Raqam / Bemor / Shifokor / Sana / Vaqt / Holat |
| Date from / to / Doctor / Status (filters) | Sanadan / Sanagacha / Shifokor / Holat |
| All (filter option) | Barchasi |
| Showing 1-20 of 57 | 57 tadan 1-20 koʻrsatilmoqda |
| Prev / Next / Page 1 of 3 | Oldingi / Keyingi / Sahifa 1 / 3 |
| Schedule: Dr. A. Rao | Jadval: Dr. A. Rao |
| Slot length, 30 min | Qabul davomiyligi, 30 daqiqa |
| Day / Day off / Start / End | Kun / Dam olish kuni / Boshlanishi / Tugashi |
| Save schedule | Jadvalni saqlash |
| Save anyway | Baribir saqlash |
| Upcoming booked appointments | Kelgusi band qilingan qabullar |
| None | Yoʻq |
| Patient: Amina | Bemor: Amina |
| Date of birth 14 Mar 1990 (age 36) | Tugʻilgan sana: 14 Mar 1990 (yoshi: 36) |
| Phone / Email | Telefon / Email |
| Visit history (newest first) | Tashriflar tarixi (yangilari birinchi) |
| Show all visits | Barcha tashriflarni koʻrsatish |
| Daily appointments report | Kunlik qabullar hisoboti |
| Format, CSV, PDF (Coming soon) | Format, CSV, PDF (Tez orada) |
| Export | Eksport |
| PDF export is coming soon (server message) | PDF eksporti tez orada qoʻshiladi |

## Status, role, day, month, specialty labels
| English | Uzbek |
|---|---|
| Booked / Completed / Cancelled / No-show | Band qilingan / Yakunlangan / Bekor qilingan / Kelmadi |
| Admin / Receptionist / Doctor | Administrator / Qabulxona xodimi / Shifokor |
| Clinic Admin / Front Desk (staff display names) | Klinika administratori / Qabulxona |
| Sunday ... Saturday | Yakshanba, Dushanba, Seshanba, Chorshanba, Payshanba, Juma, Shanba |
| Sun Mon Tue Wed Thu Fri Sat | Ya Du Se Ch Pa Ju Sh |
| Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec | Yan Fev Mar Apr May Iyn Iyl Avg Sen Okt Noy Dek |
| Cardiology, Dermatology, Pediatrics, Neurology | Kardiologiya, Dermatologiya, Pediatriya, Nevrologiya |
| Orthopedics, Gynecology, ENT, General Practice | Ortopediya, Ginekologiya, LOR, Umumiy amaliyot |
| 2:00 PM (12-hour defect label) | 2:00 PM (AM/PM oʻzgarmaydi) |

## Email and CSV
| English | Uzbek |
|---|---|
| Subject: Your ClinicBook appointment CB-304517 | Mavzu: Sizning ClinicBook qabulingiz CB-304517 |
| Reference: / Doctor: / Date: / Time: | Qabul raqami: / Shifokor: / Sana: / Vaqt: |
| Time: 10:30 (clinic local time, UTC+5) | Vaqt: 10:30 (klinikaning mahalliy vaqti, UTC+5) |
| Clinic address: 12 Garden Street, Block B | Klinika manzili: 12 Garden Street, Block B |
| Cancel appointment: /my-appointments?cancel=... | Qabulni bekor qilish: /my-appointments?cancel=... |
| To: (outbox) | Kimga: |
| Internal outbox (test environment) | Ichki pochta qutisi (test muhiti) |
| No emails sent yet. | Hozircha xat yuborilmagan. |
| ClinicBook - Daily appointments - 19 Nov 2026 | ClinicBook - Kunlik qabullar - 19 Noy 2026 |
| Time,Patient,Doctor,Status | Vaqt,Bemor,Shifokor,Holat |
| No appointments (empty day line) | Qabullar yoʻq |
| File name appointments-YYYY-MM-DD.csv | oʻzgarmaydi |
