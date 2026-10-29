export const CURRENCY = 'RM';

export function money(value: number) {
  const cents = Math.round(value * 100);
  return `${cents < 0 ? '-' : ''}${CURRENCY} ${(Math.abs(cents) / 100).toFixed(2)}`;
}
