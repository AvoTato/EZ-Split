import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildExplainPrompt, cleanExplanation, parseExplainBody, type SplitFacts } from '../src/explain.ts';

const facts: SplitFacts = {
  discount: null,
  serviceCharge: 'RM 2.00',
  serviceRate: '10%',
  tax: 'RM 1.20',
  taxRate: '6%',
  sharedItems: [{ name: 'Nasi Lemak', sharedBy: ['Ali', 'Sam'] }],
  people: [
    {
      name: 'Ali',
      share: '30%',
      items: 'RM 6.00',
      discount: null,
      serviceCharge: 'RM 0.60',
      tax: 'RM 0.36',
      rounding: null,
      total: 'RM 6.96',
    },
    {
      name: 'Sam',
      share: '70%',
      items: 'RM 14.00',
      discount: null,
      serviceCharge: 'RM 1.40',
      tax: 'RM 0.84',
      rounding: null,
      total: 'RM 16.24',
    },
  ],
  unassigned: null,
};

test('valid facts parse and come back trimmed', () => {
  const result = parseExplainBody({ ...facts, people: [{ ...facts.people[0], name: '  Ali ' }] });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.people[0].name, 'Ali');
});

test('bad bodies are rejected with a reason', () => {
  assert.equal(parseExplainBody(null).ok, false);
  assert.equal(parseExplainBody({ ...facts, people: [] }).ok, false);
  assert.equal(parseExplainBody({ ...facts, people: 'Ali' }).ok, false);
  assert.equal(parseExplainBody({ ...facts, tax: 5 }).ok, false);
  const tooMany = Array.from({ length: 21 }, () => facts.people[0]);
  assert.equal(parseExplainBody({ ...facts, people: tooMany }).ok, false);
  const longName = { ...facts.people[0], name: 'x'.repeat(61) };
  assert.equal(parseExplainBody({ ...facts, people: [longName] }).ok, false);
});

test('the prompt keeps the facts inside the facts tag', () => {
  const prompt = buildExplainPrompt(facts);
  assert.match(prompt, /<facts>\{.*"Nasi Lemak".*\}<\/facts>$/s);
  assert.match(prompt, /Never calculate/);
});

test('explanations using only the given numbers are accepted', () => {
  const text =
    'Ali and Sam shared the Nasi Lemak. The 10% service charge (RM 2.00) and 6% tax (RM 1.20) were split by what each ordered: Ali had 30% so pays RM 6.96, and Sam pays RM 16.24.';
  assert.equal(cleanExplanation(`"${text}"`, facts), text);
});

test('explanations with an invented amount or rate are rejected', () => {
  assert.equal(cleanExplanation('Ali pays RM 7.00 and Sam pays RM 16.24.', facts), null);
  assert.equal(cleanExplanation('Service was 12% of the bill.', facts), null);
  assert.equal(cleanExplanation('', facts), null);
});
