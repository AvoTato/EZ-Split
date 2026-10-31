import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ParsedReceipt, ReceiptItem } from '../parseReceipt.ts';
import type { ItemAssignment } from '../receiptSession.ts';
import { allocateCents, computeSettlement, itemShareCost } from '../settlement.ts';

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
    { name: '1 of 2× Teh Tarik', price: 3.5, withCharges: 3.5 },
    { name: 'Nasi Lemak', price: 12, withCharges: 12 },
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

const cents = (value: number) => Math.round(value * 100);

test('allocateCents always adds back up and gives spare cents to the largest remainders', () => {
  assert.deepEqual(allocateCents(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocateCents(-38, [1, 1]), [-19, -19]);
  assert.deepEqual(allocateCents(10, [2, 1]), [7, 3]);
  assert.deepEqual(allocateCents(10, [0, 0]), [0, 0]);
});

test('every amount is whole cents and the bill adds up exactly to the receipt total', () => {
  const three = [...people, { id: 'kim', name: 'Kim' }];
  const receipt = receiptOf([{ name: 'Pizza', price: 10, qty: 1 }], {
    subtotal: 10,
    tax: 0.6,
    serviceCharge: 1,
    total: 11.6,
  });
  const { settlementPeople } = computeSettlement(receipt, three, [
    assign(0, 'ali', 1),
    assign(0, 'sam', 1),
    assign(0, 'kim', 1),
  ]);
  settlementPeople.forEach((p) => assert.equal(cents(p.amount), p.amount * 100));
  assert.equal(settlementPeople.reduce((s, p) => s + cents(p.amount), 0), 1160);
});

test('unassigned items carry their own share of discount, tax and service', () => {
  const receipt = receiptOf([NASI, { name: 'Satay', price: 8, qty: 1 }], {
    subtotal: 20,
    discount: 2,
    tax: 1.2,
    serviceCharge: 2,
    total: 21.2,
  });
  const { settlementPeople, unassignedItems } = computeSettlement(receipt, people, [assign(0, 'ali', 1)]);
  // Ali had 12 of 20 in items, so 60% of each adjustment, not 100%.
  assert.equal(settlementPeople[0].amount, 12.72);
  assert.deepEqual(unassignedItems, [{ name: 'Satay', price: 8, withCharges: 8.48 }]);
});

test('a negative line nobody ticked follows the dish above it and its sharers', () => {
  const receipt = receiptOf([NASI, { name: 'Member discount', price: -0.38, qty: 1 }]);
  const { settlementPeople, unassignedItems } = computeSettlement(receipt, people, [
    assign(0, 'ali', 1),
    assign(0, 'sam', 1),
  ]);
  assert.deepEqual(settlementPeople.map((p) => p.amount), [5.81, 5.81]);
  assert.deepEqual(unassignedItems, []);
});

test('an explicitly ticked negative line stays with whoever ticked it', () => {
  const receipt = receiptOf([NASI, { name: 'Voucher', price: -2, qty: 1 }]);
  const result = amounts(receipt, [assign(0, 'ali', 1), assign(0, 'sam', 1), assign(1, 'sam', 1)]);
  assert.deepEqual(result, [6, 4]);
});

test('a small gap to the printed total is shared as rounding, a big one is ignored', () => {
  const base = { subtotal: 19, tax: 1.14 };
  const rounded = computeSettlement(receiptOf([NASI, TEH], { ...base, total: 20.15 }), people, [
    assign(0, 'ali', 1),
    assign(1, 'sam', 2),
  ]).settlementPeople;
  assert.equal(rounded.reduce((s, p) => s + cents(p.amount), 0), 2015);
  assert.equal(cents(rounded[0].breakdown!.rounding + rounded[1].breakdown!.rounding), 1);

  const misread = computeSettlement(receiptOf([NASI, TEH], { ...base, total: 25 }), people, [
    assign(0, 'ali', 1),
    assign(1, 'sam', 2),
  ]).settlementPeople;
  assert.equal(misread.reduce((s, p) => s + cents(p.amount), 0), 2014);
});

test('the breakdown adds up to each amount and shows portions of shared dishes', () => {
  const receipt = receiptOf([NASI, TEH], { subtotal: 19, discount: 1.9, tax: 1.03, serviceCharge: 1.71 });
  const { settlementPeople } = computeSettlement(receipt, people, [
    assign(0, 'ali', 1),
    assign(0, 'sam', 1),
    assign(1, 'sam', 2),
  ]);
  for (const person of settlementPeople) {
    const b = person.breakdown!;
    assert.equal(cents(b.items.reduce((s, i) => s + i.cost, 0)), cents(b.itemsSubtotal));
    assert.equal(
      cents(b.itemsSubtotal - b.discount + b.tax + b.serviceCharge + b.rounding),
      cents(person.amount)
    );
  }
  assert.deepEqual(settlementPeople[0].breakdown!.items, [{ name: 'Nasi Lemak', shares: 1, outOf: 2, cost: 6 }]);
});
