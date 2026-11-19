import { collection, environment, folder, request } from './builder.js';

const VARIABLES = [
  { key: 'baseUrl', value: 'http://localhost:3201' },
  { key: 'cartId', value: '' },
  { key: 'lineId', value: '' },
  // Fixed-clock slot ids (20 Nov 12:00 is open, 20 Nov 10:00 is full). The slots request refreshes them when the clock differs.
  { key: 'slotId', value: '2026-11-20T12' },
  { key: 'fullSlotId', value: '2026-11-20T10' },
  { key: 'orderNumber', value: '' },
];

const CART_SHAPE = { cartId: 'string', lines: 'array', totals: 'object', limit: 'number' };
const TOTALS_SHAPE = {
  'totals.subtotalCents': 'number',
  'totals.discountCents': 'number',
  'totals.deliveryCents': 'number',
  'totals.taxCents': 'number',
  'totals.totalCents': 'number',
};
const SAVE_CART = { cartId: 'cartId' };
const SAVE_CART_AND_LINE = { ...SAVE_CART, lineId: 'lines[0].lineId' };
const PAGE_SHAPE = { items: 'array', total: 'number', page: 'number', pageCount: 'number', pageSize: 'number' };
const PRODUCT_SHAPE = {
  id: 'number',
  name: 'string',
  priceCents: 'number',
  unit: 'string',
  stock: 'number',
  imageCount: 'number',
  description: 'string',
};
const ORDER_SHAPE = { number: 'string', totals: 'object', delivery: 'object', lines: 'array' };

const DELIVERY = {
  fullName: 'Amina Test',
  phone: '5550101234',
  street: '1 Test Street',
  city: 'Springfield',
  zip: '12345',
  slotId: '{{slotId}}',
};
const CARD = { number: '4242 4242 4242 4242', expiry: '12/29', cvc: '123', name: 'Amina Test' };

const addItem = (name, productId, quantity, extra = {}) => ({
  name,
  method: 'POST',
  path: '/api/cart/items',
  cart: true,
  body: { productId, quantity },
  shape: CART_SHAPE,
  save: SAVE_CART_AND_LINE,
  ...extra,
});

const getSlots = {
  name: 'Tayyorlash: GET /api/delivery/slots - yetkazib berish vaqtlari',
  path: '/api/delivery/slots',
  shape: { days: 'array' },
  // Postman-only refresh (the shared runner ignores these lines and uses the fixed-clock defaults).
  extraTest: [
    'try { pm.collectionVariables.set("slotId", pm.response.json().days[1].slots.find(function (s) { return s.selectable; }).id); } catch (e) { /* default stays */ }',
    'try { pm.collectionVariables.set("fullSlotId", pm.response.json().days[1].slots.find(function (s) { return s.full; }).id); } catch (e) { /* default stays */ }',
  ],
  description: "Keyingi 3 kun uchun 2 soatlik vaqtlarni qaytaradi. Test skripti keyingi so'rovlar uchun tanlash mumkin bo'lgan va to'lgan vaqt id'larini o'zgaruvchilarga saqlaydi.",
};

const clearCart = { name: 'Tayyorlash: POST /api/cart/clear - savatni tozalash', method: 'POST', path: '/api/cart/clear', cart: true, shape: CART_SHAPE, description: "Keyingi so'rovlar toza savatdan boshlanishi uchun savatni bo'shatadi." };

const F11 = folder(
  'F1.1 Product listing page',
  [
    "/products ochilganda har sahifada 12 ta mahsulot ko'rsatiladi (kompyuterda 4 ustun, telefonda 2 ustun).",
    "Har bir kartada rasm, nom (ko'pi bilan 2 qator, keyin ko'p nuqta), $0.00 ko'rinishidagi narx (2 xona kasr bilan) va «Savatga qo'shish» tugmasi bo'ladi.",
    "Sahifalash sahifa raqamlari, «Oldingi» va «Keyingi» tugmalarini ko'rsatadi; birinchi sahifada «Oldingi», oxirgisida «Keyingi» o'chirilgan.",
    "Standart saralash «Nomi A-Z». «Narx: arzondan qimmatga» va «Narx: qimmatdan arzonga» butun ro'yxatni to'g'ri saralaydi.",
    "Mahsulot topilmasa «Mahsulotlar topilmadi» matni ko'rsatiladi va sahifalash yashiriladi.",
  ],
  [
    { name: 'GET /api/products - mahsulotlar ro\'yxati (1-sahifa)', path: '/api/products', shape: PAGE_SHAPE, ac: [1, 2, 4], description: "Standart saralash bilan birinchi sahifa. items, total, page, pageCount va pageSize maydonlarini tekshiring." },
    { name: 'GET /api/products?page=2 - 2-sahifa', path: '/api/products', query: { page: 2 }, shape: PAGE_SHAPE, ac: [1, 3], description: "Sahifalash: sahifalar soni (pageCount) va jami mahsulotlar (total) o'zaro mos kelishini hisoblab ko'ring." },
    { name: 'GET /api/products?sort=price-asc - arzondan qimmatga', path: '/api/products', query: { sort: 'price-asc' }, shape: PAGE_SHAPE, ac: [4], description: 'Narx bo\'yicha o\'sish tartibi.' },
    { name: 'GET /api/products?sort=price-desc - qimmatdan arzonga', path: '/api/products', query: { sort: 'price-desc' }, shape: PAGE_SHAPE, ac: [4], description: "Narx bo'yicha kamayish tartibi. Natijadagi priceCents qiymatlarini solishtiring." },
    { name: "GET /api/products?page=999 - oxirgi sahifadan keyingi sahifa", path: '/api/products', query: { page: 999 }, shape: PAGE_SHAPE, ac: [5], description: "Mavjud bo'lmagan sahifa: items bo'sh massiv bo'lishi kerak." },
    { name: 'GET /api/categories - kategoriyalar', path: '/api/categories', json: 'array', description: "Kategoriyalar ro'yxati va ulardagi mahsulotlar soni (count)." },
    { name: 'GET /img/12/1.svg - mahsulot rasmi', path: '/img/12/1.svg', json: false, contentType: 'image/svg+xml', description: "12-mahsulotning birinchi rasmi (SVG). Javob turi image/svg+xml bo'lishini tekshiring." },
  ],
  "Mahsulotlar ro'yxati API'si. Barcha so'rovlar autentifikatsiyasiz.",
);

const F12 = folder(
  'F1.2 Product search with suggestions',
  [
    "Qidiruv maydoniga 2 yoki undan ko'p belgi kiritilganda 300 ms dan keyin ko'pi bilan 5 ta taklif chiqadi. 2 belgidan kam bo'lsa taklif chiqmaydi.",
    "Qidiruv bosh harf/kichik harfga bog'liq emas. Mos kelgan qism qalin yoziladi.",
    "Enter yoki lupa bosilganda /search?q=so'z ochiladi. Sarlavha: «\"so'z\" bo'yicha natijalar». So'z doim oddiy matn sifatida ko'rsatiladi, hech qachon HTML sifatida talqin qilinmaydi.",
    "Qidiruv maydoni ko'pi bilan 50 belgi qabul qiladi.",
    "Hech narsa topilmasa: «\"so'z\" bo'yicha mahsulot topilmadi. Boshqa so'z kiriting.»",
    "X tugmasi matnni tozalaydi va takliflarni yopadi.",
  ],
  [
    { name: 'GET /api/suggest?q=Sut - takliflar (bosh harf)', path: '/api/suggest', query: { q: 'Sut' }, json: 'array', ac: [1, 2], description: "Takliflar massivi. Eng ko'pi bilan 5 ta bo'lishi kerak." },
    { name: 'GET /api/suggest?q=sut - takliflar (kichik harf)', path: '/api/suggest', query: { q: 'sut' }, json: 'array', ac: [2], description: "Xuddi shu so'z kichik harf bilan: natijani avvalgi so'rov bilan solishtiring." },
    { name: 'GET /api/suggest?q=a - bitta belgi', path: '/api/suggest', query: { q: 'a' }, json: 'array', ac: [1], description: "Bitta belgi bilan taklif so'rovi." },
    { name: "GET /api/suggest - so'zsiz so'rov", path: '/api/suggest', json: 'array', ac: [1], description: "q parametri yo'q: bo'sh massiv kutiladi." },
    { name: "GET /api/products?q=Sut - qidiruv natijalari", path: '/api/products', query: { q: 'Sut' }, shape: PAGE_SHAPE, ac: [3, 5], description: "Qidiruv natijalari sahifasi ishlatadigan so'rov." },
    { name: "GET /api/products?q=sut - kichik harfli qidiruv", path: '/api/products', query: { q: 'sut' }, shape: PAGE_SHAPE, ac: [2, 5], description: "Natija sonini (total) avvalgi so'rov bilan solishtiring." },
    { name: "GET /api/products?q=<b>test</b> - belgilar bilan qidiruv", path: '/api/products', query: { q: '<b>test</b>' }, shape: PAGE_SHAPE, ac: [3, 5], description: "So'zda HTML belgilari bor. API ma'lumot qaytaradi; brauzerdagi sarlavhada bu so'z qanday ko'rinishini ilovada tekshiring." },
    { name: "GET /api/products?q=<60 belgi> - uzun so'z", path: '/api/products', query: { q: 'a'.repeat(60) }, shape: PAGE_SHAPE, ac: [4], description: "60 belgili so'z bilan qidiruv. 50 belgi chegarasi ilovada qanday ishlashini brauzerda ham tekshiring." },
  ],
  "Qidiruv va takliflar. Namunadagi so'z: «Sut» (sut mahsulotlari).",
);

const F13 = folder(
  'F1.3 Category and price filters',
  [
    "Yon panel 8 ta kategoriyani mahsulotlar soni bilan ko'rsatadi. Birini tanlash ro'yxatni filtrlaydi va manzilni yangilaydi (/products?category=dairy).",
    "Narx filtri butun dollarda Min va Maks (0–999). «Qo'llash» chegaralarni o'z ichiga oladi: aynan Min yoki Maks narxdagi mahsulotlar ham kiradi.",
    "Min Maks'dan katta bo'lsa maydonlar ostida «Minimal narx maksimal narxdan oshmasligi kerak» xabari chiqadi va filtrlanmaydi.",
    "«Hammasini tozalash» kategoriya va narx filtrlarini olib tashlaydi.",
    "Har bir faol filtr olib tashlash mumkin bo'lgan chip ko'rinishida ko'rsatiladi.",
  ],
  [
    { name: 'GET /api/products?category=dairy - kategoriya filtri', path: '/api/products', query: { category: 'dairy' }, shape: PAGE_SHAPE, ac: [1], description: "Kategoriya bo'yicha filtr. total qiymatini /api/categories dagi count bilan solishtiring." },
    { name: 'GET /api/products?min=2&max=10 - narx oralig\'i', path: '/api/products', query: { min: 2, max: 10 }, shape: PAGE_SHAPE, ac: [2], description: "Narx oralig'i butun dollarda. priceCents chegaralari 200 va 1000." },
    { name: 'GET /api/products?min=10&max=10 - bitta narx', path: '/api/products', query: { min: 10, max: 10 }, shape: PAGE_SHAPE, ac: [2], description: "Min va Maks teng: aynan $10.00 narxdagi mahsulot natijada bo'lishi kerakmi? Qabul mezoniga qarang." },
    { name: 'GET /api/products?min=12&max=5 - Min Maks\'dan katta', path: '/api/products', query: { min: 12, max: 5 }, expect: [200, 400], shape: PAGE_SHAPE, ac: [3], description: "Noto'g'ri oraliq. Qaysi holat kodi va javob matni to'g'ri ekanini qabul mezoni bo'yicha o'zingiz hal qiling." },
    { name: "GET /api/products?category=yoq - noma'lum kategoriya", path: '/api/products', query: { category: 'yoq' }, shape: PAGE_SHAPE, ac: [1], description: "Mavjud bo'lmagan kategoriya: bo'sh natija." },
    { name: "GET /api/products?min=abc - raqam bo'lmagan qiymat", path: '/api/products', query: { min: 'abc' }, shape: PAGE_SHAPE, ac: [2], description: "Min uchun raqam bo'lmagan qiymat." },
  ],
  "Filtrlar so'rov parametrlari orqali beriladi: category, min, max.",
);

const F14 = folder(
  'F1.4 Product detail page',
  [
    "/products/{id} nom, 4 tagacha rasm, narx va birlik, tavsif va ombor holatini ko'rsatadi.",
    "Miqdor 1 dan boshlanadi, eng kami 1, eng ko'pi 10.",
    "«Savatga qo'shish» tanlangan miqdorni savatga qo'shadi va «Savatga qo'shildi» xabarini 4 soniya ko'rsatadi.",
    "Noma'lum mahsulot id'si 404 sahifasini («Mahsulot topilmadi») ko'rsatadi.",
    "Navigatsiya «Bosh sahifa > Kategoriya > Mahsulot nomi» ishlaydi.",
  ],
  [
    { name: 'GET /api/products/12 - mahsulot tafsilotlari', path: '/api/products/12', shape: PRODUCT_SHAPE, ac: [1], description: "12-mahsulot: rasmlar soni (imageCount), narx, birlik va ombor miqdori." },
    { name: "GET /api/products/99999 - noma'lum mahsulot", path: '/api/products/99999', expect: 404, ac: [4], description: "Mavjud bo'lmagan id: 404 va JSON xato." },
    { name: "GET /api/products/abc - noto'g'ri id", path: '/api/products/abc', expect: 404, ac: [4], description: "Raqam bo'lmagan id." },
    addItem('POST /api/cart/items - 3 dona qo\'shish', 19, 3, { ac: [3], description: "19-mahsulot (banan) dan 3 dona savatga. Savat id'si saqlanadi." }),
    addItem("POST /api/cart/items - miqdor 0", 19, 0, { expect: 400, shape: undefined, save: undefined, ac: [2], description: "Noto'g'ri miqdor: 400 va xato matni." }),
    addItem("POST /api/cart/items - miqdor 11", 19, 11, { ac: [2], description: "Mahsulot sahifasida miqdor 10 dan oshmasligi kerak. API bu chegarani qanday qo'llashini kuzating.", shape: undefined, save: undefined, expect: [200, 400] }),
  ],
  "Mahsulot tafsilotlari va savatga qo'shish.",
);

const F15 = folder(
  'F1.5 Out-of-stock handling and Notify me',
  [
    "Ombordagi miqdori 0 bo'lgan mahsulotda «Sotuvda yo'q» belgisi ko'rinadi.",
    "Sotuvda yo'q mahsulotda «Savatga qo'shish» o'rniga «Menga xabar bering» tugmasi chiqadi; uni savatga qo'shib bo'lmaydi.",
    "«Menga xabar bering» email so'raydi. To'g'ri email majburiy. Yuborilgach «Mahsulot qaytganda sizga email yuboramiz.» xabari chiqadi.",
    "1–5 ta qolgan mahsulotda «Atigi N ta qoldi» (to'q sariq), 6 va undan ko'pda omborga oid matn ko'rsatilmaydi.",
  ],
  [
    { name: "GET /api/products/12 - ombor 0", path: '/api/products/12', shape: PRODUCT_SHAPE, ac: [1], description: "Ombordagi miqdori 0 bo'lgan mahsulot (stock)." },
    { name: 'GET /api/products/11 - ombor 3', path: '/api/products/11', shape: PRODUCT_SHAPE, ac: [4], description: "Kam qolgan mahsulot." },
    { name: 'GET /api/products/13 - ombor 6', path: '/api/products/13', shape: PRODUCT_SHAPE, ac: [4], description: "Ombor 6 ta: «atigi N ta qoldi» matni kerakmi? Qabul mezoniga qarang." },
    { name: "POST /api/cart/items - sotuvda yo'q mahsulotni qo'shish", method: 'POST', path: '/api/cart/items', cart: true, body: { productId: 12, quantity: 1 }, expect: [200, 409], shape: CART_SHAPE, ac: [2], description: "Ombori 0 bo'lgan mahsulotni savatga qo'shishga urinish. To'g'ri javobni qabul mezoni bo'yicha o'zingiz hal qiling." },
    { name: 'POST /api/notify-me - mahsulot qaytganda xabar berish', method: 'POST', path: '/api/notify-me', body: { productId: 12, email: 'amina@example.com' }, expect: [201, 404], shape: undefined, ac: [3], description: "«Menga xabar bering» uchun so'rov. Bu funksiya hali to'liq qurilmagan bo'lishi mumkin: javob holat kodini qayd qiling va Product Owner'ga savol sifatida yozing." },
  ],
  "Ombor holati. Bu funksiya qisman qurilgan (Blocked).",
);

const F21 = folder(
  'F2.1 Add to cart and mini-cart',
  [
    "«Savatga qo'shish» 1 dona qo'shadi va sarlavhadagi savat nishoni darhol yangilanadi. Nishon savatdagi jami dona sonini ko'rsatadi.",
    "Savatda bor mahsulot yana qo'shilsa yangi qator ochilmaydi, mavjud qator miqdori oshadi.",
    "Mini-savat ko'pi bilan 3 ta mahsulotni, so'ng «+N ta mahsulot yana» va oraliq jamini ko'rsatadi.",
    "Bir mahsulotdan savatda ko'pi bilan 99 dona. Chegarada «Maksimal miqdorga yetildi» xabari chiqadi.",
    "Mehmon savati 7 kun saqlanadi: sahifani yangilaganda ham, brauzer yopilib qayta ochilganda ham.",
  ],
  [
    { name: 'GET /api/cart - yangi savat', path: '/api/cart', cart: true, shape: CART_SHAPE, save: SAVE_CART, ac: [5], description: "Savat id'si bo'lmasa yangi savat yaratiladi. cartId keyingi so'rovlarda X-Cart-Id sarlavhasi bilan yuboriladi." },
    addItem("POST /api/cart/items - 19-mahsulotdan 1 dona", 19, 1, { ac: [1], description: "Birinchi qo'shish." }),
    addItem("POST /api/cart/items - xuddi shu mahsulotni yana qo'shish", 19, 1, { ac: [2], description: "Savatdagi qatorlar sonini (lines) va miqdorlarni solishtiring." }),
    addItem("POST /api/cart/items - boshqa mahsulot (14)", 14, 2, { ac: [3], description: "Savatda bir nechta qator hosil qilish." }),
    { name: 'PATCH /api/cart/lines/{{lineId}} - miqdor 99', method: 'PATCH', path: '/api/cart/lines/{{lineId}}', cart: true, body: { quantity: 99 }, shape: CART_SHAPE, ac: [4], description: "Miqdorni chegaraga yetkazish." },
    { name: 'PATCH /api/cart/lines/{{lineId}} - miqdor 100', method: 'PATCH', path: '/api/cart/lines/{{lineId}}', cart: true, body: { quantity: 100 }, shape: CART_SHAPE, ac: [4], description: "Chegaradan oshgan miqdor: limit va limitReached maydonlariga qarang." },
    addItem("POST /api/cart/items - noma'lum mahsulot", 99999, 1, { expect: 404, shape: undefined, save: undefined, description: "Mavjud bo'lmagan mahsulot: 404." }),
    addItem("POST /api/cart/items - manfiy miqdor", 19, -1, { expect: 400, shape: undefined, save: undefined, description: "Noto'g'ri miqdor: 400." }),
  ],
  "Savat X-Cart-Id sarlavhasi bilan aniqlanadi. Birinchi so'rov cartId o'zgaruvchisini saqlaydi.",
);

const F22 = folder(
  'F2.2 Cart page: quantity and totals',
  [
    "/cart har bir mahsulotni rasm, nom, dona narxi, miqdor tugmalari, qator jami va «Olib tashlash» havolasi bilan ko'rsatadi.",
    "Miqdor o'zgarsa qator jami va buyurtma xulosasi sahifa yangilanmasdan darhol o'zgaradi.",
    "Miqdor kamida 1. «Olib tashlash» qatorni o'chiradi.",
    "Oraliq jami — qator jamlari yig'indisi. Yetkazib berish: oraliq jami $30.00 dan kam bo'lsa $4.00, $30.00 va undan ko'p bo'lsa $0.00. Soliq — oraliq jamning 8% (sentgacha yaxlitlangan). Jami = oraliq jami + yetkazib berish + soliq.",
    "Savat bo'sh bo'lsa «Savatingiz bo'sh» matni va «Xaridni davom ettirish» tugmasi chiqadi.",
  ],
  [
    clearCart,
    addItem('Tayyorlash: POST /api/cart/items - olma (17) x2', 17, 2, { description: "Savatga 17-mahsulot (olma, $1.20) dan 2 dona." }),
    addItem('Tayyorlash: POST /api/cart/items - tuxum (13) x1', 13, 1, { description: "Savatga 13-mahsulotdan 1 dona. Jami: 2 x $1.20 + $4.50 = $6.90." }),
    { name: 'GET /api/cart - jamlar', path: '/api/cart', cart: true, shape: { ...CART_SHAPE, ...TOTALS_SHAPE }, ac: [1, 4], description: "Oraliq jami, yetkazib berish, soliq va jamini qo'lda hisoblab, javob bilan solishtiring (summalar sentda)." },
    { name: 'PATCH /api/cart/lines/{{lineId}} - miqdor 5', method: 'PATCH', path: '/api/cart/lines/{{lineId}}', cart: true, body: { quantity: 5 }, shape: { ...CART_SHAPE, ...TOTALS_SHAPE }, ac: [2], description: "Miqdor o'zgarganda qator jami va umumiy jamlar yangilanadi." },
    addItem("Tayyorlash: POST /api/cart/items - pishloq (14) x2", 14, 2, { description: "Oraliq jamni $30.00 atrofiga yetkazish uchun. Yetkazib berish haqini kuzating." }),
    { name: 'DELETE /api/cart/lines/{{lineId}} - qatorni olib tashlash', method: 'DELETE', path: '/api/cart/lines/{{lineId}}', cart: true, shape: CART_SHAPE, ac: [3], description: "Qatorni o'chirish." },
    { name: "DELETE /api/cart/lines/yoq - noma'lum qator", method: 'DELETE', path: '/api/cart/lines/yoq', cart: true, expect: 404, ac: [3], description: "Mavjud bo'lmagan qator id'si." },
    { name: "PATCH /api/cart/lines/{{lineId}} - miqdor 0", method: 'PATCH', path: '/api/cart/lines/{{lineId}}', cart: true, body: { quantity: 0 }, expect: [400, 404], ac: [3], description: "Miqdor 0 ruxsat etilmaydi. Qator avvalgi qadamda o'chirilgan bo'lishi mumkin, shuning uchun 404 ham bo'lishi mumkin." },
    { ...clearCart, name: 'POST /api/cart/clear - savatni bo\'shatish', ac: [5], description: "Savatni to'liq bo'shatish: lines bo'sh massiv va jamlar 0 bo'lishi kerak." },
    { name: 'GET /api/cart - bo\'sh savat', path: '/api/cart', cart: true, shape: CART_SHAPE, ac: [5], description: "Bo'sh savatning javobi." },
  ],
  "Savat jamlari: barcha summalar sentda (priceCents, totalCents va hokazo).",
);

const F23 = folder(
  'F2.3 Promo code',
  [
    "Savat sahifasida promokod maydoni va «Qo'llash» tugmasi bor. To'g'ri kod yashil «Promokod qo'llandi: KOD» matnini ko'rsatadi.",
    "Kodlar katta-kichik harfga bog'liq emas. FRESH10 — oraliq jamdan 10% (kamida $20.00). SAVE5 — $5.00 chegirma (kamida $25.00). Minimaldan past bo'lsa kod qo'llanmaydi.",
    "Noma'lum kod: «Promokod yaroqsiz». Muddati o'tgan kod (SUMMER20): «Promokod muddati tugagan».",
    "Bir vaqtda faqat bitta kod faol. Yangi to'g'ri kod avvalgisini almashtiradi.",
    "Chegirma soliqdan oldin manfiy qator sifatida ko'rsatiladi, soliq chegirmadan keyin hisoblanadi.",
    "«Olib tashlash» chegirmasiz jamlarni qaytaradi.",
  ],
  [
    clearCart,
    addItem('Tayyorlash: POST /api/cart/items - pishloq (14) x3', 14, 3, { description: "Oraliq jami $42.00." }),
    { name: 'POST /api/cart/promo - FRESH10', method: 'POST', path: '/api/cart/promo', cart: true, body: { code: 'FRESH10' }, shape: { ...CART_SHAPE, ...TOTALS_SHAPE, promoMessage: 'string' }, ac: [1, 2, 5], description: "To'g'ri promokod. promoMessage va discountCents ga qarang." },
    { name: 'POST /api/cart/promo - fresh10 (kichik harf)', method: 'POST', path: '/api/cart/promo', cart: true, body: { code: 'fresh10' }, expect: [200, 400], ac: [2], description: "Kichik harfli kod. To'g'ri javobni qabul mezoni bo'yicha hal qiling." },
    { name: 'POST /api/cart/promo - SAVE5 (ikkinchi kod)', method: 'POST', path: '/api/cart/promo', cart: true, body: { code: 'SAVE5' }, shape: { ...CART_SHAPE, promoCodes: 'array' }, ac: [4], description: "Ikkinchi kod qo'llanganda promoCodes massivida nechta kod qolishini tekshiring." },
    { name: 'POST /api/cart/promo - SUMMER20 (muddati o\'tgan)', method: 'POST', path: '/api/cart/promo', cart: true, body: { code: 'SUMMER20' }, expect: 400, ac: [3], description: "Muddati o'tgan kod: xato matnini qabul mezoni bilan solishtiring." },
    { name: "POST /api/cart/promo - noma'lum kod", method: 'POST', path: '/api/cart/promo', cart: true, body: { code: 'NOPE' }, expect: 400, ac: [3], description: "Mavjud bo'lmagan kod." },
    { name: "POST /api/cart/promo - bo'sh kod", method: 'POST', path: '/api/cart/promo', cart: true, body: { code: '' }, expect: 400, ac: [1], description: "Bo'sh kod: «Promokodni kiriting»." },
    { ...clearCart, name: 'Tayyorlash: POST /api/cart/clear - minimal summa uchun savatni almashtirish' },
    addItem('Tayyorlash: POST /api/cart/items - mahsulot 46 ($19.99)', 46, 1, { description: "Oraliq jami $19.99: FRESH10 uchun minimaldan ($20.00) bir sent kam." }),
    { name: 'POST /api/cart/promo - FRESH10 minimaldan past', method: 'POST', path: '/api/cart/promo', cart: true, body: { code: 'FRESH10' }, expect: [200, 400], ac: [2], description: "Minimal oraliq jamdan past savat. To'g'ri javobni qabul mezoni bo'yicha hal qiling." },
    { name: 'DELETE /api/cart/promo - kodni olib tashlash', method: 'DELETE', path: '/api/cart/promo', cart: true, shape: CART_SHAPE, ac: [6], description: "Promokodni olib tashlash: promoCodes bo'sh va chegirma 0 bo'lishi kerak." },
  ],
  "Promokodlar: FRESH10, SAVE5 va muddati o'tgan SUMMER20.",
);

const F24 = folder(
  'F2.4 Delivery slot and address step',
  [
    "2-qadam to'liq ism, telefon (aynan 10 xona), ko'cha, shahar va ZIP (aynan 5 xona) so'raydi. Hammasi majburiy va dizayndagi xato matnlari ko'rsatiladi.",
    "Vaqt tanlagich keyingi 3 kunni, 08:00–20:00 oralig'ida 2 soatlik vaqtlarni va qolgan joylar sonini ko'rsatadi. To'lgan vaqt o'chirilgan va «To'lgan» deb belgilangan.",
    "Bugungi vaqtni boshlanishiga 2 soat qolguncha tanlash mumkin.",
    "«Davom etish» faqat barcha maydonlar to'g'ri va vaqt tanlangan bo'lsagina faol bo'ladi.",
    "Tanlangan vaqt 10 daqiqa ushlab turiladi va «Vaqt ushlab turilmoqda: mm:ss» hisoblagichi ko'rsatiladi.",
  ],
  [
    clearCart,
    addItem('Tayyorlash: POST /api/cart/items - mahsulot 14 x1', 14, 1, { description: "Yetkazib berish bosqichi uchun savat." }),
    { ...getSlots, ac: [2, 3] },
    { name: "POST /api/checkout/delivery - to'g'ri ma'lumotlar", method: 'POST', path: '/api/checkout/delivery', cart: true, body: DELIVERY, shape: { cartId: 'string', delivery: 'object' }, ac: [1, 4], description: "To'g'ri manzil va tanlash mumkin bo'lgan vaqt." },
    { name: "POST /api/checkout/delivery - telefonda harflar", method: 'POST', path: '/api/checkout/delivery', cart: true, body: { ...DELIVERY, phone: 'abc123xyz0' }, expect: [200, 400], ac: [1], description: "Telefon aynan 10 xonali raqam bo'lishi kerak. To'g'ri javobni qabul mezoni bo'yicha hal qiling." },
    { name: "POST /api/checkout/delivery - ZIP 4 xonali", method: 'POST', path: '/api/checkout/delivery', cart: true, body: { ...DELIVERY, zip: '1234' }, expect: [200, 400], ac: [1], description: "ZIP aynan 5 xona bo'lishi kerak." },
    { name: "POST /api/checkout/delivery - ko'cha bo'sh", method: 'POST', path: '/api/checkout/delivery', cart: true, body: { ...DELIVERY, street: '' }, expect: 400, ac: [1], description: "Majburiy maydon bo'sh: 400 va fieldErrors." },
    { name: "POST /api/checkout/delivery - vaqt tanlanmagan", method: 'POST', path: '/api/checkout/delivery', cart: true, body: { ...DELIVERY, slotId: '' }, expect: 400, ac: [4], description: "Vaqt tanlanmasa davom etib bo'lmaydi." },
    { name: "POST /api/checkout/delivery - to'lgan vaqt", method: 'POST', path: '/api/checkout/delivery', cart: true, body: { ...DELIVERY, slotId: '{{fullSlotId}}' }, expect: [200, 409], ac: [2], description: "To'lgan vaqtni tanlashga urinish. To'g'ri javobni qabul mezoni bo'yicha hal qiling." },
    { ...clearCart, name: 'Tayyorlash: POST /api/cart/clear - savatni bo\'shatish' },
    { name: "POST /api/checkout/delivery - bo'sh savat", method: 'POST', path: '/api/checkout/delivery', cart: true, body: DELIVERY, expect: 409, ac: [4], description: "Savat bo'sh: «Savatingiz bo'sh»." },
  ],
  "Yetkazib berish. Vaqt id'lari GET /api/delivery/slots javobidan olinadi.",
);

const F25 = folder(
  'F2.5 Payment and order confirmation',
  [
    "To'lov bosqichi karta raqami, amal qilish muddati (MM/YY), CVC va karta egasining ismini so'raydi.",
    "Karta raqami Luhn tekshiruvidan o'tishi kerak; aks holda «Karta raqami noto'g'ri».",
    "Muddati (oy va yil) o'tgan karta «Karta muddati tugagan» bilan rad etiladi. Joriy oy hali yaroqli.",
    "To'lov jarayonida «Buyurtma berish» o'chirilgan va aylanuvchi belgi ko'rsatadi: buyurtmani ikki marta yuborib bo'lmaydi.",
    "Muvaffaqiyatli to'lovda tasdiq sahifasi buyurtma raqami (FC- va 6 xona), mahsulotlar, jami, yetkazib berish vaqti va manzilni ko'rsatadi.",
    "Rad etilgan karta (sinov kartasi 4000 0000 0000 0002) to'lov bosqichida qoldiradi: «To'lov rad etildi. Boshqa kartani sinab ko'ring.» Savat saqlanadi.",
  ],
  [
    clearCart,
    addItem('Tayyorlash: POST /api/cart/items - mahsulot 14 x2', 14, 2, { description: "To'lov uchun savat." }),
    getSlots,
    { name: 'Tayyorlash: POST /api/checkout/delivery', method: 'POST', path: '/api/checkout/delivery', cart: true, body: DELIVERY, shape: { cartId: 'string', delivery: 'object' }, description: "To'lovdan oldin yetkazib berish ma'lumotlari saqlanadi." },
    { name: "POST /api/checkout/pay - noto'g'ri karta raqami", method: 'POST', path: '/api/checkout/pay', cart: true, body: { ...CARD, number: '1234' }, expect: 400, ac: [1, 2], description: "Qisqa karta raqami: 400 va fieldErrors.number." },
    { name: "POST /api/checkout/pay - Luhn'dan o'tmaydigan raqam", method: 'POST', path: '/api/checkout/pay', cart: true, body: { ...CARD, number: '4111 1111 1111 1112' }, expect: [201, 400], ac: [2], description: "13–19 xonali, lekin Luhn tekshiruvidan o'tmaydigan raqam. To'g'ri javobni qabul mezoni bo'yicha hal qiling." },
    { name: "POST /api/checkout/pay - muddati o'tgan karta", method: 'POST', path: '/api/checkout/pay', cart: true, body: { ...CARD, expiry: '12/20' }, expect: [201, 400], ac: [3], description: "2020-yilda tugagan karta. To'g'ri javobni qabul mezoni bo'yicha hal qiling." },
    { name: "POST /api/checkout/pay - CVC bo'sh", method: 'POST', path: '/api/checkout/pay', cart: true, body: { ...CARD, cvc: '' }, expect: 400, ac: [1], description: "Majburiy maydon bo'sh." },
    { name: 'POST /api/checkout/pay - rad etiladigan sinov kartasi', method: 'POST', path: '/api/checkout/pay', cart: true, body: { ...CARD, number: '4000 0000 0000 0002' }, expect: [201, 402], ac: [6], description: "Sinov kartasi 4000 0000 0000 0002 rad etilishi kerak. To'lov provayderi sandbox'i hali ulanmagan: soxta (mock) xizmat ishlaydi." },
    { name: 'POST /api/checkout/pay - to\'g\'ri karta', method: 'POST', path: '/api/checkout/pay', cart: true, body: CARD, expect: 201, shape: ORDER_SHAPE, save: { orderNumber: 'number' }, ac: [1, 5], description: "To'g'ri karta bilan to'lov. Buyurtma raqami orderNumber o'zgaruvchisiga saqlanadi." },
    { name: 'GET /api/orders/{{orderNumber}} - buyurtmani olish', path: '/api/orders/{{orderNumber}}', shape: ORDER_SHAPE, ac: [5], description: "Tasdiq sahifasi ishlatadigan so'rov: raqam FC- va 6 xonadan iborat bo'lishi kerak." },
    { name: "GET /api/orders/FC-000000 - noma'lum buyurtma", path: '/api/orders/FC-000000', expect: 404, ac: [5], description: "Mavjud bo'lmagan buyurtma raqami." },
    { name: "POST /api/checkout/pay - to'lovdan keyin yana to'lash", method: 'POST', path: '/api/checkout/pay', cart: true, body: CARD, expect: [201, 409], ac: [4], description: "Muvaffaqiyatli to'lovdan keyin xuddi shu savat bilan yana to'lov so'rovi. Buyurtmalar sonini Facilitator tools papkasidagi so'rov bilan tekshiring." },
  ],
  "To'lov soxta (mock) xizmat orqali ishlaydi: haqiqiy karta ma'lumotlarini kiritmang. Sinov kartalari: 4242 4242 4242 4242 (muvaffaqiyatli), 4000 0000 0000 0002 (rad etiladi).",
);

const FACILITATOR = {
  name: 'Facilitator tools',
  description: "Faqat o'qituvchi uchun. /api/config amaldagi sinov holatini (xatolar yoqilgan yoki yo'qligini) ko'rsatadi: stajyorlarga mashq tugamaguncha ko'rsatmang.",
  item: [
    { name: 'GET /api/config - build rejimi', path: '/api/config', shape: { mode: 'string', defects: 'object', now: 'string' }, description: "Rejim (on = xatolar bor, off = ma'lumotnoma build), xatolar ro'yxati va qat'iy soat." },
    { name: 'GET /api/dev/storage - Notion yozuv navbati', path: '/api/dev/storage', shape: { mode: 'string', pending: 'number' }, description: "Saqlash rejimi (notion yoki memory), kutilayotgan yozuvlar soni, oxirgi xato va oxirgi sinxronlash vaqti." },
    { name: 'GET /api/dev/orders - barcha buyurtmalar', path: '/api/dev/orders', json: 'array', description: "Hozirgi barcha buyurtmalar ro'yxati (Notion'dagi FC Orders bilan bir xil bo'lishi kerak)." },
  ],
};

const DESCRIPTION = [
  "# FreshCart API (o'quv loyihasi)",
  "Bu to'plam FreshCart onlayn oziq-ovqat do'konining REST API'sini o'rganish uchun. Ilova brauzer uchun ham, Postman uchun ham bir xil API'dan foydalanadi.",
  "## Tayyorlash",
  "1. Ilovani ishga tushiring (`npm start`, port 3201) va muhitda `baseUrl = http://localhost:3201` ekanini tekshiring.\n2. Papkalarni yuqoridan pastga qarab ishga tushiring (Collection Runner yoki alohida so'rovlar). Har bir papka Notion'dagi bitta Feature'ga mos.",
  "## Qanday ishlaydi",
  "- **Savat:** server savatni `X-Cart-Id` sarlavhasi bilan taniydi. Savatga oid birinchi javobdagi `cartId` o'zgaruvchiga avtomatik saqlanadi.\n- **Summalar:** barcha summalar sentda (masalan, `priceCents: 120` = $1.20).\n- **Xatolar:** xato javobi `{ \"error\": \"matn\", \"fieldErrors\": { maydon: \"matn\" } }` ko'rinishida; holat kodlari: 400 noto'g'ri ma'lumot, 402 to'lov rad etildi, 404 topilmadi, 409 holat mos emas.\n- **Soat:** server soati qat'iy: 2026-yil 19-noyabr, 15:00 (yetkazib berish vaqtlari shunga bog'liq).",
  "## Testlar haqida",
  "Har bir so'rovda faqat oddiy testlar bor: holat kodi, JSON formati va asosiy maydonlar. **Qabul mezonlarini tekshiruvchi testlarni siz yozasiz**: so'rov tavsifidagi mezonlarni o'qing, javobni solishtiring va farq topsangiz Notion'da Bug yarating. Ba'zi so'rovlarda test bir nechta holat kodini qabul qiladi: to'g'ri javobni qabul mezonidan aniqlang.",
].join('\n\n');

/** The whole FreshCart collection (Postman v2.1.0). */
export function buildCollection() {
  return collection({
    name: 'FreshCart API',
    description: DESCRIPTION,
    items: [
      F11, F12, F13, F14, F15, F21, F22, F23, F24, F25,
      {
        name: FACILITATOR.name,
        description: FACILITATOR.description,
        item: FACILITATOR.item.map((def) => request(def)),
      },
    ],
    variables: VARIABLES,
  });
}

/** The matching Postman environment (baseUrl and the variables the tests fill in). */
export function buildEnvironment() {
  return environment({ name: 'FreshCart (local)', values: VARIABLES });
}
