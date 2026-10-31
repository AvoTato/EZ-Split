import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_IMAGE_BYTES,
  RECEIPT_PROMPT,
  RECEIPT_SCHEMA,
  decodedSize,
  normalizeReceipt,
  parseRequestBody,
} from '../src/receipt.ts';

const TINY = Buffer.from('hello receipt').toString('base64');

test('accepts a well-formed request', () => {
  const result = parseRequestBody({ image: TINY, mediaType: 'image/jpeg' });
  assert.deepEqual(result, { ok: true, image: TINY, mediaType: 'image/jpeg' });
});

test('rejects non-objects, missing image and bad media types', () => {
  assert.equal(parseRequestBody(null).ok, false);
  assert.equal(parseRequestBody('x').ok, false);
  assert.equal(parseRequestBody({ mediaType: 'image/jpeg' }).ok, false);
  assert.equal(parseRequestBody({ image: '', mediaType: 'image/jpeg' }).ok, false);
  assert.equal(parseRequestBody({ image: TINY, mediaType: 'application/pdf' }).ok, false);
});

test('rejects images that are not base64', () => {
  assert.equal(parseRequestBody({ image: 'not base64!!', mediaType: 'image/png' }).ok, false);
  assert.equal(parseRequestBody({ image: 'abc', mediaType: 'image/png' }).ok, false);
  assert.equal(parseRequestBody({ image: 'data:image/png;base64,AAAA', mediaType: 'image/png' }).ok, false);
});

test('rejects images over the size limit', () => {
  const big = Buffer.alloc(MAX_IMAGE_BYTES + 3).toString('base64');
  assert.equal(parseRequestBody({ image: big, mediaType: 'image/jpeg' }).ok, false);
  const fits = Buffer.alloc(MAX_IMAGE_BYTES).toString('base64');
  assert.equal(parseRequestBody({ image: fits, mediaType: 'image/jpeg' }).ok, true);
});

test('decodedSize accounts for padding', () => {
  for (const length of [0, 1, 2, 3, 10, 11, 12]) {
    const bytes = Buffer.alloc(length);
    assert.equal(decodedSize(bytes.toString('base64')), length);
  }
});

const valid = {
  items: [
    { name: ' Teh Tarik ', price: 7, qty: 2 },
    { name: 'Nasi Lemak', price: 12.504, qty: 1 },
  ],
  subtotal: 19.5,
  discount: -2,
  serviceCharge: null,
  tax: 1.17,
  total: 20.67,
};

test('normalizes a valid receipt', () => {
  assert.deepEqual(normalizeReceipt(valid), {
    items: [
      { name: 'Teh Tarik', price: 7, qty: 2 },
      { name: 'Nasi Lemak', price: 12.5, qty: 1 },
    ],
    subtotal: 19.5,
    discount: 2,
    serviceCharge: null,
    tax: 1.17,
    total: 20.67,
    needsReview: false,
  });
});

test('treats missing amounts as null and bad quantities as 1', () => {
  const receipt = normalizeReceipt({ items: [{ name: 'Roti', price: 3, qty: 0 }] });
  assert.deepEqual(receipt?.items, [{ name: 'Roti', price: 3, qty: 1 }]);
  assert.equal(receipt?.subtotal, null);
  assert.equal(receipt?.discount, null);
});

test('rejects malformed receipts', () => {
  assert.equal(normalizeReceipt(null), null);
  assert.equal(normalizeReceipt({ items: 'x' }), null);
  assert.equal(normalizeReceipt({ items: [{ name: 'A', price: '3', qty: 1 }] }), null);
  assert.equal(normalizeReceipt({ items: [{ name: 'A', price: Number.NaN, qty: 1 }] }), null);
  assert.equal(normalizeReceipt({ ...valid, total: 'free' }), null);
});

test('normalizeReceipt keeps negative item prices', () => {
  const receipt = normalizeReceipt({
    items: [
      { name: 'BM BigBrkfst', price: 12.17, qty: 1 },
      { name: 'S Hot Teh Tarik', price: -0.38, qty: 1 },
    ],
    subtotal: 11.79,
    discount: null,
    serviceCharge: null,
    tax: 2.44,
    total: 14.23,
  });
  assert.equal(receipt?.items[1].price, -0.38);
});

test('the prompt explains negative lines, the tax amount and the payable total', () => {
  assert.ok(RECEIPT_PROMPT.includes('NEGATIVE price'));
  assert.ok(RECEIPT_PROMPT.includes('never a total that includes tax'));
  assert.ok(RECEIPT_PROMPT.includes('incl Tax'));
});

test('the schema has a rounding slot and the prompt pairs skewed totals in order', () => {
  assert.ok(RECEIPT_SCHEMA.required.includes('rounding'));
  assert.ok(RECEIPT_PROMPT.includes('Pair them in order'));
});

const skewed = {
  items: [{ name: 'Braised Duck', price: 98.5, qty: 1 }],
  subtotal: 98.5,
  discount: null,
  serviceCharge: 4.93,
  tax: 5.91,
  total: 0.01,
};

test('a total read as the rounding amount is rebuilt from the other amounts', () => {
  assert.equal(normalizeReceipt({ ...skewed, rounding: 0.01 })?.total, 109.35);
  assert.equal(normalizeReceipt({ ...skewed, rounding: null })?.total, 109.35);
});

test('a total that adds up, or is far off, is left alone', () => {
  assert.equal(normalizeReceipt({ ...skewed, total: 109.35, rounding: 0.01 })?.total, 109.35);
  assert.equal(normalizeReceipt({ ...skewed, total: 150 })?.total, 150);
  assert.equal(normalizeReceipt({ ...skewed, serviceCharge: 98.5 })?.total, 0.01);
});
