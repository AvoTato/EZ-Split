import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  billSections,
  billsForPayment,
  computeBalances,
  exactBillForPayment,
  overallProgress,
  payBackStatus,
  reminderSessionFor,
  settledEntries,
  settlementProgress,
  simplifyDebts,
  type Payment,
} from '../debts.ts';
import type { SettlementSummarySession } from '../receiptSession.ts';

const bill = (
  paidBy: string | undefined,
  amounts: Record<string, number>,
  settledIds?: string[],
): { summary: SettlementSummarySession } => ({
  summary: {
    note: '',
    paidBy,
    settledIds,
    people: Object.entries(amounts).map(([id, amount]) => ({ id, name: id.toUpperCase(), amount })),
  },
});

const netOf = (balances: { id: string; cents: number }[]) =>
  Object.fromEntries(balances.map((b) => [b.id, b.cents]));

test('payer is credited what the others owe, others are debited', () => {
  const balances = computeBalances([bill('a', { a: 10, b: 20, c: 30 })]);
  assert.deepEqual(netOf(balances), { a: 5000, b: -2000, c: -3000 });
});

test('bills without a payer are ignored', () => {
  const balances = computeBalances([bill(undefined, { a: 10, b: 20 })]);
  assert.deepEqual(balances, []);
});

test('balances always sum to zero', () => {
  const balances = computeBalances([
    bill('a', { a: 12.34, b: 20.1, c: 7.77 }),
    bill('b', { a: 5.55, b: 9.99, c: 3.33 }),
  ]);
  assert.equal(balances.reduce((sum, b) => sum + b.cents, 0), 0);
});

test('a chain A owes B, B owes C collapses to A paying C', () => {
  const balances = computeBalances([
    bill('b', { a: 10, b: 0 }),
    bill('c', { b: 10, c: 0 }),
  ]);
  const transfers = simplifyDebts(balances);
  assert.deepEqual(transfers, [{ fromId: 'a', fromName: 'A', toId: 'c', toName: 'C', amount: 10 }]);
});

test('opposite debts between two people net out to one transfer', () => {
  const balances = computeBalances([
    bill('a', { a: 0, b: 30 }),
    bill('b', { a: 10, b: 0 }),
  ]);
  const transfers = simplifyDebts(balances);
  assert.deepEqual(transfers, [{ fromId: 'b', fromName: 'B', toId: 'a', toName: 'A', amount: 20 }]);
});

test('simplified transfers never exceed members minus one', () => {
  const balances = computeBalances([
    bill('a', { a: 0, b: 11, c: 22, d: 33 }),
    bill('b', { a: 14, b: 0, c: 9, d: 5 }),
    bill('c', { a: 8, b: 6, c: 0, d: 12 }),
  ]);
  const transfers = simplifyDebts(balances);
  assert.ok(transfers.length <= 3);
  const net = netOf(balances);
  transfers.forEach((t) => {
    net[t.fromId] += Math.round(t.amount * 100);
    net[t.toId] -= Math.round(t.amount * 100);
  });
  Object.values(net).forEach((cents) => assert.equal(cents, 0));
});

test('a recorded payment reduces the remaining debt', () => {
  const payment: Payment = { id: '1', fromId: 'b', toId: 'a', amount: 12, createdAt: 0 };
  const balances = computeBalances([bill('a', { a: 0, b: 20 })], [payment]);
  assert.deepEqual(simplifyDebts(balances), [
    { fromId: 'b', fromName: 'B', toId: 'a', toName: 'A', amount: 8 },
  ]);
});

test('fully paid debts produce no transfers', () => {
  const payment: Payment = { id: '1', fromId: 'b', toId: 'a', amount: 20, createdAt: 0 };
  const balances = computeBalances([bill('a', { a: 0, b: 20 })], [payment]);
  assert.deepEqual(simplifyDebts(balances), []);
});

test('members with no bills still appear with a zero balance', () => {
  const balances = computeBalances([], [], [{ id: 'z', name: 'Zed' }]);
  assert.deepEqual(balances, [{ id: 'z', name: 'Zed', cents: 0 }]);
});

test('progress is zero when nothing has been paid yet', () => {
  const transfers = simplifyDebts(computeBalances([bill('a', { a: 0, b: 20 })]));
  assert.deepEqual(settlementProgress(transfers, []), { settled: 0, remaining: 20, total: 20, fraction: 0 });
});

test('progress counts recorded payments against what is still owed', () => {
  const payment: Payment = { id: '1', fromId: 'b', toId: 'a', amount: 5, createdAt: 0 };
  const bills = [bill('a', { a: 0, b: 20 })];
  const transfers = simplifyDebts(computeBalances(bills, [payment]));
  assert.deepEqual(settlementProgress(transfers, [payment]), {
    settled: 5,
    remaining: 15,
    total: 20,
    fraction: 0.25,
  });
});

test('progress is complete when everything is paid and empty when there are no debts', () => {
  const payment: Payment = { id: '1', fromId: 'b', toId: 'a', amount: 20, createdAt: 0 };
  assert.equal(settlementProgress([], [payment]).fraction, 1);
  assert.equal(settlementProgress([], []).fraction, 0);
});

test('a friend who already paid back is left out of the balances', () => {
  const balances = computeBalances([bill('a', { a: 10, b: 20, c: 30 }, ['b'])]);
  assert.deepEqual(netOf(balances), { a: 3000, b: 0, c: -3000 });
  assert.deepEqual(simplifyDebts(balances), [
    { fromId: 'c', fromName: 'C', toId: 'a', toName: 'A', amount: 30 },
  ]);
});

test('everyone paying back leaves nothing owed', () => {
  const balances = computeBalances([bill('a', { a: 10, b: 20, c: 30 }, ['b', 'c'])]);
  assert.deepEqual(simplifyDebts(balances), []);
});

test('marking the payer as settled changes nothing', () => {
  const balances = computeBalances([bill('a', { a: 10, b: 20 }, ['a'])]);
  assert.deepEqual(netOf(balances), { a: 2000, b: -2000 });
});

test('payBackStatus without a payer has no friends and nothing owed', () => {
  const status = payBackStatus(bill(undefined, { a: 10, b: 20 }).summary);
  assert.equal(status.payer, null);
  assert.deepEqual(status.friends, []);
  assert.equal(status.remaining, 0);
});

test('payBackStatus counts who paid back and what is still owed', () => {
  const status = payBackStatus(bill('a', { a: 10, b: 20, c: 30.5 }, ['b']).summary);
  assert.equal(status.payer?.id, 'a');
  assert.deepEqual(
    status.friends.map((f) => [f.id, f.paidBack]),
    [['b', true], ['c', false]],
  );
  assert.equal(status.paidBackCount, 1);
  assert.equal(status.remaining, 30.5);
});

test('payBackStatus ignores a settled mark on the payer and reports everyone paid back', () => {
  const status = payBackStatus(bill('a', { a: 10, b: 20 }, ['a', 'b']).summary);
  assert.equal(status.friends.length, 1);
  assert.equal(status.paidBackCount, 1);
  assert.equal(status.remaining, 0);
});

test('reminderSessionFor makes the person who owes the only one to remind', () => {
  const session = reminderSessionFor({
    fromId: 'j',
    fromName: 'jess',
    toId: 'm',
    toName: 'mike',
    amount: 24.93,
  });
  assert.equal(session.paidBy, 'm');
  assert.deepEqual(session.people, [
    { id: 'm', name: 'mike', amount: 0 },
    { id: 'j', name: 'jess', amount: 24.93 },
  ]);
  const status = payBackStatus(session);
  assert.equal(status.payer?.name, 'mike');
  assert.deepEqual(status.friends.map((f) => f.name), ['jess']);
});

const named = (
  id: string,
  name: string,
  createdAt: number,
  paidBy: string | undefined,
  amounts: Record<string, number>,
  settledIds?: string[],
) => ({ id, name, createdAt, ...bill(paidBy, amounts, settledIds) });

const dinner = named('1', 'Dinner', 1000, 'm', { m: 5, j: 8.17, w: 10 });
const lunch = named('2', 'Lunch', 2000, 'm', { m: 5, j: 12.4, w: 3 });
const pay = (fromId: string, toId: string, amount: number, createdAt = 5000): Payment => ({
  id: `${fromId}${toId}${amount}`,
  fromId,
  toId,
  amount,
  createdAt,
});

test('a payment is matched to the bill whose share equals the amount', () => {
  const refs = billsForPayment([dinner, lunch], pay('j', 'm', 8.17));
  assert.deepEqual(refs.map((r) => r.name), ['Dinner']);
});

test('a payment with no exact match lists every bill the person owed on, newest first', () => {
  const refs = billsForPayment([dinner, lunch], pay('j', 'm', 20.57));
  assert.deepEqual(refs.map((r) => r.name), ['Lunch', 'Dinner']);
});

test('a payment prefers bills paid upfront by the person it went to', () => {
  const other = named('3', 'Brunch', 3000, 'w', { w: 5, j: 9 });
  const refs = billsForPayment([dinner, other], pay('j', 'w', 20));
  assert.deepEqual(refs.map((r) => r.name), ['Brunch']);
});

test('a payment falls back to any bill the person owed on when the payee does not match', () => {
  const refs = billsForPayment([dinner], pay('j', 'someone-else', 8.17));
  assert.deepEqual(refs.map((r) => r.name), ['Dinner']);
});

test('a payment with no related bill has no bill reference', () => {
  assert.deepEqual(billsForPayment([dinner], pay('x', 'm', 1)), []);
});

test('settledEntries includes payments and friends ticked paid on a bill', () => {
  const ticked = named('3', 'Brunch', 3000, 'm', { m: 5, j: 9, w: 4 }, ['w']);
  const entries = settledEntries([dinner, ticked], [pay('j', 'm', 8.17, 9000)], { j: 'Jess', m: 'Mike' });
  assert.deepEqual(
    entries.map((e) => [e.kind, e.fromName, e.toName, e.amount, e.bills.map((b) => b.name)]),
    [
      ['payment', 'Jess', 'Mike', 8.17, ['Dinner']],
      ['bill', 'W', 'M', 4, ['Brunch']],
    ],
  );
  assert.equal(entries[0].paidAt, 9000);
  assert.equal(entries[1].paidAt, null);
  assert.equal(entries[1].settlementId, '3');
});

test('settledEntries ignores settled marks without a payer or on the payer', () => {
  const noPayer = named('4', 'Odd', 1, undefined, { a: 5, b: 6 }, ['a']);
  const onPayer = named('5', 'Odd2', 1, 'a', { a: 5, b: 6 }, ['a']);
  assert.deepEqual(settledEntries([noPayer, onPayer], []), []);
});

test('settledEntries are sorted newest first', () => {
  const entries = settledEntries([dinner], [pay('j', 'm', 8.17, 100), pay('w', 'm', 10, 300)], {});
  assert.deepEqual(entries.map((e) => e.sortAt), [300, 100]);
});

test('progress counts bill-level settled amounts too', () => {
  const ticked = named('3', 'Brunch', 3000, 'm', { m: 5, w: 4 }, ['w']);
  const transfers = simplifyDebts(computeBalances([ticked]));
  const progress = settlementProgress(transfers, settledEntries([ticked], []));
  assert.equal(progress.fraction, 1);
});

test('exactBillForPayment only returns a bill when the share matches to the sen', () => {
  assert.equal(exactBillForPayment([dinner, lunch], pay('j', 'm', 8.17))?.name, 'Dinner');
  assert.equal(exactBillForPayment([dinner, lunch], pay('j', 'm', 20.57)), null);
  assert.equal(exactBillForPayment([dinner], pay('x', 'm', 8.17)), null);
});

test('billSections are newest first with the payer and total', () => {
  const sections = billSections([dinner, lunch]);
  assert.deepEqual(sections.map((s) => s.name), ['Lunch', 'Dinner']);
  assert.equal(sections[0].payer?.name, 'M');
  assert.equal(sections[0].total, 20.4);
});

test('billSections lists friends who have not paid before those who have', () => {
  const [section] = billSections([named('9', 'Trip', 1, 'm', { m: 5, j: 8, w: 10, k: 3 }, ['j'])]);
  assert.deepEqual(section.friends.map((f) => [f.id, f.paidBack]), [
    ['w', false],
    ['k', false],
    ['j', true],
  ]);
  assert.equal(section.paidBackCount, 1);
  assert.equal(section.remaining, 13);
  assert.equal(section.allPaid, false);
});

test('billSections marks a fully paid bill and flags a bill with no payer', () => {
  const [paid, unpaid] = billSections([
    named('1', 'Paid', 2, 'm', { m: 5, j: 8 }, ['j']),
    named('2', 'NoPayer', 1, undefined, { m: 5, j: 8 }),
  ]);
  assert.equal(paid.allPaid, true);
  assert.equal(paid.remaining, 0);
  assert.equal(unpaid.hasPayer, false);
  assert.equal(unpaid.payer, null);
  assert.deepEqual(unpaid.friends, []);
  assert.equal(unpaid.allPaid, false);
});

test('billSections leaves out friends who owe nothing', () => {
  const [section] = billSections([named('1', 'Trip', 1, 'm', { m: 5, j: 0, w: 4 })]);
  assert.deepEqual(section.friends.map((f) => f.id), ['w']);
});

test('overallProgress adds up paid and total across bills with a payer', () => {
  const sections = billSections([
    named('1', 'A', 2, 'm', { m: 5, j: 10, w: 10 }, ['j']),
    named('2', 'B', 1, undefined, { m: 5, j: 99 }),
  ]);
  assert.deepEqual(overallProgress(sections), { paid: 10, total: 20, fraction: 0.5 });
  assert.equal(overallProgress([]).fraction, 0);
});
