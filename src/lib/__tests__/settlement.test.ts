import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ParsedReceipt, ReceiptItem } from '../parseReceipt.ts';
import type { ItemAssignment } from '../receiptSession.ts';
import { computeSettlement, itemShareCost } from '../settlement.ts';

const people = [
  { id: 'ali', name: 'Ali' },
  { id: 'sam', name: 'Sam' },
];

const receiptOf = (items: ReceiptItem[], extra: Partial<ParsedReceipt> = {}): ParsedReceipt => ({
  items,
  subtotal: null,
  discount: null,
  serviceCharge: null,
  tax: null,
  total: null,
  needsReview: false,
  ...extra,
});

const assign = (itemIndex: number, personId: string, shares: number): ItemAssignment => ({
  itemIndex,
  personId,
  shares,
});

const amounts = (receipt: ParsedReceipt, assignments: ItemAssignment[]) =>
  computeSettlement(receipt, people, assignments).settlementPeople.map((p) =>
    Math.round(p.amount * 100) / 100
  );

const NASI = { name: 'Nasi Lemak', price: 12, qty: 1 };
const TEH = { name: 'Teh Tarik', price: 7, qty: 2 };

test('two people sharing one dish split it instead of each paying full price', () => {
  assert.deepEqual(amounts(receiptOf([NASI]), [assign(0, 'ali', 1), assign(0, 'sam', 1)]), [6, 6]);
});

test('one person having every unit pays the line total, not line total × units', () => {
  assert.deepEqual(amounts(receiptOf([TEH]), [assign(0, 'ali', 2)]), [7, 0]);
});

test('units are split by how many each person had', () => {
  assert.deepEqual(amounts(receiptOf([TEH]), [assign(0, 'ali', 1), assign(0, 'sam', 1)]), [3.5, 3.5]);
  assert.deepEqual(amounts(receiptOf([TEH]), [assign(0, 'ali', 2), assign(0, 'sam', 1)]), [4.67, 2.33]);
});

test('unassigned units of a multi-unit line are listed as leftovers', () => {
  const { settlementPeople, unassignedItems } = computeSettlement(receiptOf([TEH, NASI]), people, [
    assign(0, 'ali', 1),
  ]);
  assert.equal(settlementPeople[0].amount, 3.5);
  assert.deepEqual(unassignedItems, [
    { name: '1 of 2× Teh Tarik', price: 3.5 },
    { name: 'Nasi Lemak', price: 12 },
  ]);
});

test('itemShareCost never divides by zero', () => {
  assert.equal(itemShareCost({ name: 'x', price: 5, qty: 0 }, 1, 0), 5);
});

test('discount, tax and service are split in proportion and add up to the total', () => {
  const receipt = receiptOf([NASI, TEH], {
    subtotal: 19,
    discount: 1.9,
    tax: 1.03,
    serviceCharge: 1.71,
    total: 19.84,
  });
  const result = amounts(receipt, [assign(0, 'ali', 1), assign(1, 'ali', 1), assign(1, 'sam', 1)]);
  assert.equal(Math.round((result[0] + result[1]) * 100) / 100, 19.84);
  // Ali had RM15.50 of RM19 in items, so he carries 15.5/19 of every adjustment.
  assert.equal(result[0], Math.round(15.5 * (19.84 / 19) * 100) / 100);
});
