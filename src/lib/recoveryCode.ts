// The recovery code is the device's secret key, written in Crockford base32 so it
// survives being read aloud or retyped: no I, L, O or U, and case doesn't matter.
// Keep in step with normalizeCode/isValidCode in server/src/store.ts.

const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{32}$/;

export function normalizeCode(input: string) {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function isValidCode(input: string) {
  return CODE_PATTERN.test(normalizeCode(input));
}

// "ABCD-EFGH-..." in groups of four, easier to copy by hand.
export function formatCode(input: string) {
  return normalizeCode(input).replace(/(.{4})(?=.)/g, '$1-');
}
