import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { SettlementSummarySession } from '../receiptSession.ts';
import { billSnapshot, mergePaid, withShareLink } from '../shareBill.ts';

const session: SettlementSummarySession = {
  people: [
    { id: 'a', name: 'Aisha', amount: 20 },
    { id: 'b', name: ' Ben ', amount: 12.5 },
    { id: 'c', name: 'Chen', amount: 7.25 },
  ],
  note: '',
  paidBy: 'a',
  settledIds: ['b'],
  explanation: 'not shared',
};

test('billSnapshot keeps only what the link page needs', () => {
  assert.deepEqual(billSnapshot(session, ' Dinner ', 'RM'), {
    title: 'Dinner',
    currency: 'RM',
    payerId: 'a',
    people: [
      { id: 'a', name: 'Aisha', amount: 20 },
      { id: 'b', name: 'Ben', amount: 12.5 },
      { id: 'c', name: 'Chen', amount: 7.25 },
    ],
  });
});

test('billSnapshot drops a blank title and a payer who is no longer on the bill', () => {
  const snapshot = billSnapshot({ ...session, paidBy: 'gone' }, '  ', 'RM');
  assert.equal('title' in snapshot, false);
  assert.equal('payerId' in snapshot, false);
});

test('mergePaid adds remote payers but never the payer or strangers', () => {
  assert.deepEqual(mergePaid(session, ['c', 'a', 'ghost', 'b']), ['b', 'c']);
});

test('mergePaid keeps the stored shape: undefined when nobody has paid', () => {
  assert.equal(mergePaid({ ...session, settledIds: undefined }, []), undefined);
  assert.deepEqual(mergePaid({ ...session, settledIds: undefined }, ['c']), ['c']);
});

test('withShareLink appends the link only when there is one', () => {
  assert.equal(withShareLink('Hi', null), 'Hi');
  assert.equal(withShareLink('Hi', 'https://x/s/1'), 'Hi\n\nSee the bill and mark yourself paid: https://x/s/1');
});
