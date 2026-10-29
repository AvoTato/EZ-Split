import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeInsights } from '../insights.ts';
import type { SettlementSummarySession } from '../receiptSession.ts';

const NOW = new Date(2026, 9, 29);

const bill = (
  name: string,
  date: Date,
  paidBy: string | undefined,
  amounts: Record<string, number>,
) => ({
  name,
  createdAt: date.getTime(),
  summary: {
    note: '',
    paidBy,
    people: Object.entries(amounts).map(([id, amount]) => ({ id, name: id.toUpperCase(), amount })),
  } satisfies SettlementSummarySession,
});

test('no bills gives empty insights', () => {
  const insights = computeInsights([], NOW);
  assert.equal(insights.billCount, 0);
  assert.equal(insights.averageBill, 0);
  assert.equal(insights.biggestBill, null);
  assert.equal(insights.topPayer, null);
  assert.equal(insights.topSpender, null);
  assert.equal(insights.months.length, 6);
});

test('this month only counts bills from the current calendar month', () => {
  const insights = computeInsights(
    [
      bill('Dinner', new Date(2026, 9, 3), 'a', { a: 10, b: 20 }),
      bill('Lunch', new Date(2026, 9, 20), 'b', { a: 5, b: 5 }),
      bill('Old', new Date(2026, 8, 30), 'a', { a: 50, b: 50 }),
    ],
    NOW,
  );
  assert.equal(insights.thisMonthTotal, 40);
  assert.equal(insights.thisMonthCount, 2);
});

test('monthly totals run oldest to newest and ignore bills outside the window', () => {
  const insights = computeInsights(
    [
      bill('Now', new Date(2026, 9, 1), 'a', { a: 10 }),
      bill('Prev', new Date(2026, 8, 1), 'a', { a: 20 }),
      bill('Ancient', new Date(2025, 0, 1), 'a', { a: 999 }),
    ],
    NOW,
  );
  assert.deepEqual(
    insights.months.map((m) => m.label),
    ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
  );
  assert.deepEqual(
    insights.months.map((m) => m.total),
    [0, 0, 0, 0, 20, 10],
  );
});

test('months wrap across the year boundary', () => {
  const insights = computeInsights([bill('Dec', new Date(2025, 11, 25), 'a', { a: 12 })], new Date(2026, 1, 10));
  assert.deepEqual(
    insights.months.map((m) => m.label),
    ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
  );
  assert.equal(insights.months[3].total, 12);
});

test('average, biggest bill, top payer and top spender', () => {
  const insights = computeInsights(
    [
      bill('Dinner', new Date(2026, 9, 3), 'a', { a: 30, b: 10 }),
      bill('Brunch', new Date(2026, 9, 5), 'a', { a: 5, b: 15 }),
      bill('Movie', new Date(2026, 9, 8), 'b', { a: 10, b: 10 }),
    ],
    NOW,
  );
  assert.equal(insights.averageBill, 26.67);
  assert.deepEqual(insights.biggestBill, { name: 'Dinner', total: 40 });
  assert.deepEqual(insights.topPayer, { name: 'A', count: 2 });
  assert.deepEqual(insights.topSpender, { name: 'A', total: 45 });
});

test('bills without a payer do not count towards top payer', () => {
  const insights = computeInsights([bill('Dinner', new Date(2026, 9, 3), undefined, { a: 30 })], NOW);
  assert.equal(insights.topPayer, null);
});
