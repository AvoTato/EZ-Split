import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ParsedReceipt } from '../parseReceipt.ts';
import { interpretCommand, ruleBasedInterpreter } from '../receiptCommands.ts';
import { applyPatches } from '../receiptReview.ts';

const receipt = (): ParsedReceipt => ({
  items: [
    { name: 'Nasi Lemak', price: 10, qty: 1 },
    { name: 'Teh Tarik', price: 7, qty: 2 },
    { name: 'Roti Canai', price: 3, qty: 1 },
    { name: 'Roti Telur', price: 4, qty: 1 },
  ],
  subtotal: 24,
  discount: null,
  serviceCharge: null,
  tax: 1.44,
  total: 25.44,
  needsReview: false,
});

const run = (text: string) => {
  const r = receipt();
  const result = interpretCommand(text, r);
  assert.ok(result.ok, result.ok ? '' : result.error);
  return { result, next: applyPatches(r, result.patches) };
};

const error = (text: string) => {
  const result = interpretCommand(text, receipt());
  assert.equal(result.ok, false);
  return result.ok ? '' : result.error;
};

test('changes an item price by number, with or without RM and filler words', () => {
  for (const text of ['change item 1 to RM12', 'item 1 12', 'set item 1 price to rm 12.00', 'Item #1 = 12', '1 to 12']) {
    assert.equal(run(text).next.items[0].price, 12, text);
  }
  assert.equal(run('change item 1 to RM12').result.summary, 'Item 1 · Nasi Lemak: RM10.00 → RM12.00');
});

test('changes an item price by name', () => {
  assert.equal(run('teh tarik to 4.50').next.items[1].price, 4.5);
  assert.equal(run('NASI 9,50').next.items[0].price, 9.5);
});

test('"each" multiplies by the item quantity', () => {
  assert.equal(run('teh tarik to 4 each').next.items[1].price, 8);
});

test('changes quantity and keeps the line total', () => {
  const { result, next } = run('item 3 qty 2');
  assert.deepEqual(next.items[2], { name: 'Roti Canai', price: 3, qty: 2 });
  assert.match(result.summary, /qty 1 → 2/);
  assert.match(error('item 3 qty 1.5'), /whole number/);
});

test('renames an item', () => {
  assert.equal(run('rename item 1 to Nasi Lemak Ayam').next.items[0].name, 'Nasi Lemak Ayam');
  assert.equal(run('change item 2 name to Teh O').next.items[1].name, 'Teh O');
});

test('deletes an item by number or name', () => {
  assert.deepEqual(
    run('delete item 4').next.items.map((i) => i.name),
    ['Nasi Lemak', 'Teh Tarik', 'Roti Canai']
  );
  assert.equal(run('remove teh tarik').result.summary, 'Remove Item 2 · Teh Tarik (RM7.00)');
});

test('adds an item with optional quantity', () => {
  assert.deepEqual(run('add milo ais 4.50').next.items.at(-1), { name: 'milo ais', price: 4.5, qty: 1 });
  assert.deepEqual(run('add 2x Milo Ais RM9').next.items.at(-1), { name: 'Milo Ais', price: 9, qty: 2 });
  assert.deepEqual(run('add 2 milo ais 4.50 each').next.items.at(-1), { name: 'milo ais', price: 9, qty: 2 });
  assert.match(error('add milo ais'), /name and a price/);
});

test('sets and clears totals fields', () => {
  assert.equal(run('total 26').next.total, 26);
  assert.equal(run('set sst to 1.20').next.tax, 1.2);
  assert.equal(run('service charge 2.40').next.serviceCharge, 2.4);
  assert.equal(run('subtotal = 24.00').next.subtotal, 24);
  assert.equal(run('discount 2').next.discount, 2);
  assert.equal(run('remove tax').next.tax, null);
  assert.equal(run('set sst to 1.20').result.summary, 'SST: RM1.44 → RM1.20');
});

test('explains ambiguous, missing and unknown targets', () => {
  assert.match(error('roti to 5'), /more than one item \(item 3, item 4\)/);
  assert.match(error('item 9 to 5'), /no item 9 — the receipt has 4 items/);
  assert.match(error('cendol to 5'), /No item matches "cendol"/);
  assert.match(error('make it cheaper'), /didn't understand/);
  assert.match(error('   '), /Type what to fix/);
});

test('the async interpreter returns the same result', async () => {
  assert.deepEqual(await ruleBasedInterpreter('item 1 12', receipt()), interpretCommand('item 1 12', receipt()));
});
