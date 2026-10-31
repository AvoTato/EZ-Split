import assert from 'node:assert/strict';
import { test } from 'node:test';

import { money } from '../format.ts';
import type { ParsedReceipt } from '../parseReceipt.ts';
import { computeSettlement } from '../settlement.ts';
import { describeSplit, splitFacts } from '../splitExplanation.ts';

const people = [
  { id: 'ali', name: 'Ali' },
  { id: 'sam', name: 'Sam' },
];

const receipt: ParsedReceipt = {
  items: [
    { name: 'Nasi Lemak', price: 12, qty: 1 },
    { name: 'Satay', price: 8, qty: 1 },
  ],
  subtotal: 20,
  discount: null,
  serviceCharge: 2,
  tax: 1.2,
  total: 23.2,
  needsReview: false,
};

const factsFor = () => {
  const { settlementPeople, unassignedItems } = computeSettlement(receipt, people, [
    { itemIndex: 0, personId: 'ali', shares: 1 },
    { itemIndex: 0, personId: 'sam', shares: 1 },
    { itemIndex: 1, personId: 'sam', shares: 1 },
  ]);
  return splitFacts(receipt, settlementPeople, unassignedItems, money);
};

test('facts list shared dishes, fee rates and each person’s share', () => {
  const facts = factsFor();
  assert.deepEqual(facts.sharedItems, [{ name: 'Nasi Lemak', sharedBy: ['Ali', 'Sam'] }]);
  assert.equal(facts.serviceRate, '10%');
  assert.equal(facts.taxRate, '6%');
  assert.equal(facts.discount, null);
  assert.deepEqual(facts.people[0], {
    name: 'Ali',
    share: '30%',
    items: 'RM 6.00',
    discount: null,
    serviceCharge: 'RM 0.60',
    tax: 'RM 0.36',
    rounding: null,
    total: 'RM 6.96',
  });
  assert.equal(facts.unassigned, null);
});

test('the template explanation covers shared items, fees and every person', () => {
  const text = describeSplit(factsFor());
  assert.match(text, /Nasi Lemak between Ali and Sam/);
  assert.match(text, /Service charge 10% \(RM 2\.00\) and tax 6% \(RM 1\.20\) were split/);
  assert.match(text, /Ali had 30% of the items \(RM 6\.00\): \+RM 0\.60 service, \+RM 0\.36 tax, so pays RM 6\.96\./);
  assert.match(text, /Sam had 70%/);
});

test('a single fee reads naturally and unassigned items are mentioned', () => {
  const facts = { ...factsFor(), serviceCharge: null, serviceRate: null, unassigned: 'RM 8.00' };
  const text = describeSplit(facts);
  assert.match(text, /Tax 6% \(RM 1\.20\) was split/);
  assert.match(text, /RM 8\.00 of unassigned items/);
});
