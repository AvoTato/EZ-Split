import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ParsedReceipt } from '../parseReceipt.ts';
import {
  applyPatch,
  applyPatches,
  checkReceipt,
  expectedTotal,
  itemsSum,
  netSubtotal,
  parseMoney,
  unitPrice,
  type ReceiptIssue,
} from '../receiptReview.ts';

const receipt = (): ParsedReceipt => ({
  items: [
    { name: 'Nasi Lemak', price: 12, qty: 1 },
    { name: 'Teh Tarik', price: 7, qty: 2 },
  ],
  subtotal: 19,
  discount: null,
  serviceCharge: 1.9,
  tax: 1.14,
  total: 22.05,
  needsReview: false,
});

test('applyPatch setItem merges fields without mutating the original', () => {
  const original = receipt();
  const next = applyPatch(original, { type: 'setItem', index: 0, fields: { price: 15 } });
  assert.deepEqual(next.items[0], { name: 'Nasi Lemak', price: 15, qty: 1 });
  assert.equal(original.items[0].price, 12);
});

test('applyPatch ignores out-of-range item indexes', () => {
  const original = receipt();
  assert.equal(applyPatch(original, { type: 'setItem', index: 5, fields: { price: 1 } }), original);
  assert.equal(applyPatch(original, { type: 'removeItem', index: -1 }), original);
});

test('applyPatch add/remove items and set fields', () => {
  const next = applyPatches(receipt(), [
    { type: 'addItem', item: { name: 'Milo Ais', price: 4.5, qty: 1 } },
    { type: 'removeItem', index: 0 },
    { type: 'setField', field: 'tax', value: null },
  ]);
  assert.deepEqual(
    next.items.map((i) => i.name),
    ['Teh Tarik', 'Milo Ais']
  );
  assert.equal(next.tax, null);
});

test('itemsSum rounds to cents', () => {
  const r = receipt();
  r.items = [
    { name: 'a', price: 0.1, qty: 1 },
    { name: 'b', price: 0.2, qty: 1 },
  ];
  assert.equal(itemsSum(r), 0.3);
});

test('unitPrice divides the line total by qty', () => {
  assert.equal(unitPrice({ name: 'Teh Tarik', price: 7, qty: 2 }), 3.5);
  assert.equal(unitPrice({ name: 'x', price: 5, qty: 0 }), 5);
});

test('parseMoney accepts common typed formats', () => {
  assert.equal(parseMoney('12'), 12);
  assert.equal(parseMoney('RM 12.50'), 12.5);
  assert.equal(parseMoney('rm12,5'), 12.5);
  assert.equal(parseMoney('12.'), 12);
  assert.equal(parseMoney('.5'), 0.5);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('abc'), null);
  assert.equal(parseMoney('1.2.3'), null);
});

const ids = (issues: ReceiptIssue[]) => issues.map((issue) => issue.id);
const fixed = (r: ParsedReceipt, issue: ReceiptIssue | undefined) => {
  assert.ok(issue?.fix, 'expected a fix');
  return applyPatch(r, issue.fix.patch);
};

test('checkReceipt returns nothing for a receipt that adds up', () => {
  assert.deepEqual(checkReceipt(receipt()), []);
});

test('flags a duplicated line and removing it clears the issue', () => {
  const r = applyPatch(receipt(), { type: 'addItem', item: { name: 'nasi lemak ', price: 12, qty: 1 } });
  const issue = checkReceipt(r).find((i) => i.id === 'subtotal-duplicate');
  assert.deepEqual(issue?.target, { kind: 'item', index: 2 });
  assert.deepEqual(checkReceipt(fixed(r, issue)), []);
});

test('flags a single extra line that explains the gap', () => {
  const r = applyPatch(receipt(), { type: 'addItem', item: { name: 'Keropok', price: 2.5, qty: 1 } });
  const issue = checkReceipt(r).find((i) => i.id === 'subtotal-extra');
  assert.deepEqual(issue?.target, { kind: 'item', index: 2 });
});

test('falls back to fixing the subtotal when no single line explains the gap', () => {
  const r = applyPatch(receipt(), { type: 'setItem', index: 0, fields: { price: 12.4 } });
  const issue = checkReceipt(r).find((i) => i.id === 'subtotal-over');
  assert.equal(fixed(r, issue).subtotal, 19.4);
});

test('suggests adding a missing item when items fall short of the subtotal', () => {
  const r = applyPatch(receipt(), { type: 'removeItem', index: 1 });
  const issue = checkReceipt(r).find((i) => i.id === 'subtotal-short');
  const next = fixed(r, issue);
  assert.deepEqual(next.items.at(-1), { name: 'Missing item', price: 7, qty: 1 });
  assert.deepEqual(checkReceipt(next), []);
});

test('flags a total that does not match and suggests the expected one', () => {
  const r = applyPatch(receipt(), { type: 'setField', field: 'total', value: 30 });
  const issue = checkReceipt(r).find((i) => i.id === 'total-mismatch');
  assert.equal(fixed(r, issue).total, 22.04);
});

test('allows 5-sen rounding on the total', () => {
  const r = applyPatch(receipt(), { type: 'setField', field: 'total', value: 22.1 });
  assert.deepEqual(ids(checkReceipt(r)), []);
});

test('suggests a total when none was found', () => {
  const r = applyPatch(receipt(), { type: 'setField', field: 'total', value: null });
  const issue = checkReceipt(r).find((i) => i.id === 'total-missing');
  assert.equal(fixed(r, issue).total, 22.04);
});

test('flags a quantity that does not divide the line price evenly', () => {
  const r = applyPatch(receipt(), { type: 'setItem', index: 1, fields: { qty: 3 } });
  const issue = checkReceipt(r).find((i) => i.id === 'qty-1');
  assert.equal(fixed(r, issue).items[1].qty, 1);
  assert.equal(checkReceipt(receipt()).some((i) => i.id.startsWith('qty-')), false);
});

test('flags blank names and missing prices', () => {
  const r = applyPatch(receipt(), { type: 'addItem', item: { name: ' ', price: 0, qty: 1 } });
  assert.deepEqual(
    ids(checkReceipt(r)).filter((id) => id.endsWith('-2')),
    ['name-2', 'price-2']
  );
});

test('notes unusual SST and service rates as info only', () => {
  const r = applyPatches(receipt(), [
    { type: 'setField', field: 'tax', value: 3 },
    { type: 'setField', field: 'serviceCharge', value: 0 },
    { type: 'setField', field: 'total', value: 22 },
  ]);
  const issues = checkReceipt(r);
  assert.deepEqual(ids(issues), ['tax-rate']);
  assert.equal(issues[0].severity, 'info');
});

test('accepts a subtotal printed before or after the discount', () => {
  const before = applyPatches(receipt(), [
    { type: 'setField', field: 'discount', value: 2 },
    { type: 'setField', field: 'tax', value: 1.02 },
    { type: 'setField', field: 'serviceCharge', value: 1.7 },
    { type: 'setField', field: 'total', value: 19.72 },
  ]);
  assert.equal(netSubtotal(before), 17);
  assert.deepEqual(checkReceipt(before), []);

  const after = applyPatch(before, { type: 'setField', field: 'subtotal', value: 17 });
  assert.equal(netSubtotal(after), 17);
  assert.equal(expectedTotal(after), 19.72);
  assert.deepEqual(checkReceipt(after), []);
});
