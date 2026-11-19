const COLORS = {
  dairy: '#BBDEFB',
  bakery: '#FFE0B2',
  fruit: '#FFCDD2',
  vegetables: '#C8E6C9',
  meat: '#F8BBD0',
  drinks: '#B2EBF2',
  snacks: '#FFF9C4',
  household: '#E1BEE7',
};

/** Placeholder product picture (SVG), so the shop needs no image files. */
export function productImageSvg(product, n) {
  const bg = COLORS[product.category] ?? '#EEEEEE';
  const letter = product.name.trim().charAt(0).toUpperCase();
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${product.id}-${n}">` +
    `<rect width="200" height="200" fill="${bg}"/>` +
    `<text x="100" y="118" font-size="84" text-anchor="middle" fill="#2E7D32" font-family="Inter,Arial,sans-serif">${letter}</text>` +
    `<text x="100" y="180" font-size="16" text-anchor="middle" fill="#555" font-family="Inter,Arial,sans-serif">rasm ${n}</text>` +
    `</svg>`
  );
}
