import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TONES, buildReminder } from '../reminders.ts';

const input = { name: 'Aiman', amountLabel: 'RM 23.40', title: 'Dinner', payerName: 'Sam' };

test('every tone mentions the person, the amount, the bill and the payer', () => {
  TONES.forEach((tone) => {
    const message = buildReminder(tone, input);
    assert.ok(message.includes('Aiman'), tone);
    assert.ok(message.includes('RM 23.40'), tone);
    assert.ok(message.includes('Dinner'), tone);
    assert.ok(message.includes('Sam'), tone);
  });
});

test('tones produce different messages', () => {
  const messages = new Set(TONES.map((tone) => buildReminder(tone, input)));
  assert.equal(messages.size, TONES.length);
});

test('without a payer the message does not name anyone to pay', () => {
  const message = buildReminder('neutral', { name: 'Aiman', amountLabel: 'RM 5.00', title: 'Lunch' });
  assert.equal(message, 'Hi Aiman, your share for Lunch is RM 5.00. Please send it when you can.');
});

test('a blank title falls back to a generic phrase', () => {
  const message = buildReminder('neutral', { name: 'Aiman', amountLabel: 'RM 5.00', title: '  ' });
  assert.ok(message.includes('our bill'));
});
