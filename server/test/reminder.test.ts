import assert from 'node:assert/strict';
import { test } from 'node:test';

import worker, { type Env } from '../src/index.ts';
import { buildReminderPrompt, cleanReminder, parseReminderBody } from '../src/reminder.ts';

const valid = {
  tone: 'funny',
  name: 'Aiman',
  amountLabel: 'RM 23.40',
  title: 'Dinner',
  payerName: 'Sam',
  draft: 'Hi Aiman, your share for Dinner is RM 23.40.',
};

const makeEnv = (overrides: Partial<Env> = {}): Env => ({
  ANTHROPIC_API_KEY: 'test-key',
  APP_TOKEN: 'secret-token',
  RATE_LIMITER: { limit: async () => ({ success: true }) },
  ...overrides,
});

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://api.test/draft-reminder', {
    method: 'POST',
    headers: { Authorization: 'Bearer secret-token', 'Content-Type': 'application/json', ...headers },
    body,
  });

test('a complete request parses', () => {
  const result = parseReminderBody(valid);
  assert.equal(result.ok, true);
});

test('optional fields may be left out', () => {
  const { title, payerName, ...rest } = valid;
  const result = parseReminderBody(rest);
  assert.equal(result.ok, true);
});

test('unknown tones, missing fields and long fields are rejected', () => {
  assert.equal(parseReminderBody({ ...valid, tone: 'rude' }).ok, false);
  assert.equal(parseReminderBody({ ...valid, name: '' }).ok, false);
  assert.equal(parseReminderBody({ ...valid, draft: 'x'.repeat(601) }).ok, false);
  assert.equal(parseReminderBody({ ...valid, amountLabel: 5 }).ok, false);
  assert.equal(parseReminderBody(null).ok, false);
});

test('the prompt carries the tone and fences the draft', () => {
  const parsed = parseReminderBody(valid);
  assert.ok(parsed.ok);
  const prompt = buildReminderPrompt(parsed.value);
  assert.ok(prompt.includes('playful'));
  assert.ok(prompt.includes(`<draft>${valid.draft}</draft>`));
});

test('cleanReminder strips quotes and requires the exact amount', () => {
  const parsed = parseReminderBody(valid);
  assert.ok(parsed.ok);
  assert.equal(cleanReminder('"Pay RM 23.40 please"', parsed.value), 'Pay RM 23.40 please');
  assert.equal(cleanReminder('Pay RM 99.00 please', parsed.value), null);
  assert.equal(cleanReminder('   ', parsed.value), null);
});

test('draft-reminder requires POST and a valid token', async () => {
  assert.equal(
    (await worker.fetch(new Request('https://api.test/draft-reminder'), makeEnv())).status,
    405,
  );
  const wrong = await worker.fetch(post(JSON.stringify(valid), { Authorization: 'Bearer nope' }), makeEnv());
  assert.equal(wrong.status, 401);
});

test('draft-reminder rate limits and validates before calling the model', async () => {
  const limited = makeEnv({ RATE_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal((await worker.fetch(post(JSON.stringify(valid)), limited)).status, 429);
  assert.equal((await worker.fetch(post('not json'), makeEnv())).status, 400);
  assert.equal((await worker.fetch(post(JSON.stringify({ ...valid, tone: 'rude' })), makeEnv())).status, 400);
  const big = await worker.fetch(post('{}', { 'Content-Length': String(10 * 1024) }), makeEnv());
  assert.equal(big.status, 413);
});
