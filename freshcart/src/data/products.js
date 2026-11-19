/**
 * Seed catalog: 48 products in 8 categories (counts match the Notion implementation pages).
 * Product 12 is Whole Milk 1L (4 images). Stock values are hard-coded test values:
 * Whole Milk 0, Greek Yogurt 3, Brown Eggs 6, everything else 40.
 */

/** Order matters: it is the order of the sidebar. */
export const CATEGORIES = Object.freeze([
  { slug: 'dairy', name: "Sut mahsulotlari" },
  { slug: 'bakery', name: "Nonvoyxona" },
  { slug: 'fruit', name: "Mevalar" },
  { slug: 'vegetables', name: "Sabzavotlar" },
  { slug: 'meat', name: "Go'sht" },
  { slug: 'drinks', name: "Ichimliklar" },
  { slug: 'snacks', name: "Gazaklar" },
  { slug: 'household', name: "Uy-ro'zg'or" },
]);

const STOCK = { 11: 3, 12: 0, 13: 6 };

// [id, name, category, price in dollars, unit text]
const ROWS = [
  [1, "Fransuz baget", 'bakery', 2.2, 'dona'],
  [2, "Ekshi xamirli non", 'bakery', 4.8, 'dona'],
  [3, "Kruassan", 'bakery', 1.9, 'dona'],
  [4, "Kunjutli bagel, 6 dona", 'bakery', 4.2, 'dona'],
  [5, "Javdar noni", 'bakery', 3.6, 'dona'],
  [6, "Mafin, 4 dona", 'bakery', 5.4, 'dona'],
  [7, "Butun don tosti", 'bakery', 2.9, 'dona'],
  [8, "Sut, jo'xori 1 l", 'dairy', 2.8, 'litriga'],
  [9, "Sut, yog'sizlantirilgan 1 l", 'dairy', 1.3, 'litriga'],
  [10, "Sut, soya 1 l", 'dairy', 2.6, 'litriga'],
  [11, "Yunon yogurti", 'dairy', 3.5, 'dona'],
  [12, "Sut, to'liq yog'li 1 l", 'dairy', 1.2, 'litriga'],
  [13, "Jigarrang tuxum", 'dairy', 4.5, 'dyuzinaga'],
  [14, "Pishloq bo'lagi", 'dairy', 14.0, 'dona'],
  [15, "Tuzlangan sariyog' 250 g", 'dairy', 3.9, 'dona'],
  [16, "Qaymoq 200 ml", 'dairy', 2.4, 'dona'],
  [17, "Olma 1 kg", 'fruit', 1.2, 'kilogrammiga'],
  [18, "Avokado, 4 dona", 'fruit', 3.5, 'dona'],
  [19, "Banan 1 kg", 'fruit', 2.0, 'kilogrammiga'],
  [20, "Apelsin 1 kg", 'fruit', 2.7, 'kilogrammiga'],
  [21, "Limon 500 g", 'fruit', 2.3, 'dona'],
  [22, "Qulupnay 400 g", 'fruit', 4.9, 'dona'],
  [23, "Yovvoyi maymunjon 250 g", 'fruit', 5.5, 'dona'],
  [24, "Uzum 500 g", 'fruit', 3.8, 'dona'],
  [25, "Mango", 'fruit', 2.6, 'dona'],
  [26, "Nok 1 kg", 'fruit', 2.9, 'kilogrammiga'],
  [27, "Ananas", 'fruit', 3.4, 'dona'],
  [28, "Kivi, 6 dona", 'fruit', 3.1, 'dona'],
  [29, "Petrushka bog'i", 'vegetables', 0.8, 'dona'],
  [30, "Pomidor 1 kg", 'vegetables', 3.2, 'kilogrammiga'],
  [31, "Sabzi 1 kg", 'vegetables', 2.1, 'kilogrammiga'],
  [32, "Qo'ziqorin 250 g", 'vegetables', 2.5, 'dona'],
  [33, "Kartoshka 2 kg", 'vegetables', 3.0, 'dona'],
  // Deliberately long name: the card must cut it after 2 lines with an ellipsis.
  [34, "Kichik oilaviy xo'jaliklarda sovuq usulda siqilgan oliy navli zaytun moyi, 750 ml shisha", 'vegetables', 21.0, 'dona'],
  [35, "Tovuq ko'kragi 500 g", 'meat', 7.5, 'dona'],
  [36, "Mol go'shti qiymasi 500 g", 'meat', 8.9, 'dona'],
  [37, "Losos filesi 300 g", 'meat', 10.0, 'dona'], // priced exactly $10.00 (price filter boundary)
  [38, "Kurka go'shti bo'laklari 150 g", 'meat', 3.6, 'dona'],
  [39, "Sosiska, 6 dona", 'meat', 5.7, 'dona'],
  [40, "Apelsin sharbati 1 l", 'drinks', 2.9, 'litriga'],
  [41, "Gazlangan suv 6x1 l", 'drinks', 4.1, 'dona'],
  [42, "Siqilgan olma sharbati 1 l", 'drinks', 2.6, 'litriga'],
  [43, "Yashil choy, 20 paket", 'drinks', 3.3, 'dona'],
  [44, "Tuzlangan yeryong'oq 200 g", 'snacks', 2.5, 'dona'],
  [45, "Qora shokolad 100 g", 'snacks', 2.3, 'dona'],
  [46, "Manuka asali 500 g", 'snacks', 19.99, 'dona'], // $19.99 (promo minimum boundary)
  [47, "Kir yuvish vositasi 1,5 l", 'household', 9.99, 'dona'], // $9.99 (price filter boundary)
  [48, "Qog'oz sochiqlar, 4 rulon", 'household', 6.5, 'dona'],
];

const DESCRIPTIONS = { 12: "Yangi pasterizatsiyalangan to'liq sut, 3,5% yog'li." };

export const PRODUCTS = Object.freeze(
  ROWS.map(([id, name, category, price, unit]) =>
    Object.freeze({
      id,
      name,
      category,
      priceCents: Math.round(price * 100),
      unit,
      stock: STOCK[id] ?? 40,
      imageCount: 4,
      description: DESCRIPTIONS[id] ?? `${name}. Sifati tekshirilgan, yangi holda yetkaziladi.`,
    }),
  ),
);
