import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatCode, isValidCode, normalizeCode } from '../recoveryCode.ts';

const CODE = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

test('formatCode groups the code in fours', () => {
  assert.equal(formatCode(CODE), '0123-4567-89AB-CDEF-GHJK-MNPQ-RSTV-WXYZ');
});

test('retyped codes normalize back: case, dashes, spaces and look-alike letters', () => {
  assert.equal(normalizeCode('o123 4567-89ab-cdef ghjk-mnpq-rstv-wxyz'), CODE);
  assert.equal(normalizeCode('i'), '1');
  assert.equal(normalizeCode('L'), '1');
  assert.equal(isValidCode(formatCode(CODE).toLowerCase()), true);
});

test('incomplete or foreign codes are rejected', () => {
  assert.equal(isValidCode(''), false);
  assert.equal(isValidCode(CODE.slice(0, 31)), false);
  assert.equal(isValidCode(`${CODE}0`), false);
  assert.equal(isValidCode(`${CODE.slice(0, 31)}U`), false);
});
