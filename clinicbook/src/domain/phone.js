/** +1 555 010 1234 -> +1 *** *** 1234 (only the last 4 digits stay visible). */
export function maskPhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  return `+1 *** *** ${digits.slice(-4)}`;
}
