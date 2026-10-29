import assert from 'node:assert/strict';
import { test } from 'node:test';

import { money } from '../format.ts';

test('money formats amounts with two decimals', () => {
  assert.equal(money(5), 'RM 5.00');
  assert.equal(money(11.789), 'RM 11.79');
});

test('money puts the minus sign before the currency', () => {
  assert.equal(money(-0.38), '-RM 0.38');
});

test('money never shows a negative zero', () => {
  assert.equal(money(-0.001), 'RM 0.00');
  assert.equal(money(-0), 'RM 0.00');
});
