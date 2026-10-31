export const CURRENCY = 'RM';

export function money(value: number) {
  const cents = Math.round(value * 100);
  return `${cents < 0 ? '-' : ''}${CURRENCY} ${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function pctOf(part: number | null, whole: number | null) {
  if (part === null || whole === null || whole === 0) return null;
  return Math.round((part / whole) * 100);
}
