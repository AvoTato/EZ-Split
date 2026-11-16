import assert from 'node:assert/strict';
import { test } from 'node:test';

import worker, { type Env } from '../src/index.ts';
import { isValidCode, newSecret, newShareId, normalizeCode, validateBill } from '../src/store.ts';
import { fakeD1 } from './fakeD1.ts';

const BASE = 'https://api.test';

const makeEnv = (overrides: Partial<Env> = {}): Env => ({
  ANTHROPIC_API_KEY: 'test-key',
  APP_TOKEN: 'secret-token',
  RATE_LIMITER: { limit: async () => ({ success: true }) },
  DATA_LIMITER: { limit: async () => ({ success: true }) },
  DB: fakeD1(),
  ...overrides,
});

const call = (env: Env, method: string, path: string, options: { key?: string; body?: unknown; raw?: string } = {}) =>
  worker.fetch(
    new Request(`${BASE}${path}`, {
      method,
      headers: {
        ...(options.key ? { Authorization: `Bearer ${options.key}` } : {}),
        'Content-Type': options.raw !== undefined ? 'application/x-www-form-urlencoded' : 'application/json',
      },
      body: options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    }),
    env
  );

async function register(env: Env) {
  const response = await call(env, 'POST', '/devices', { key: 'secret-token' });
  assert.equal(response.status, 201);
  const { key } = (await response.json()) as { key: string };
  return key;
}

const BILL = {
  title: 'Dinner at <Mamak>',
  currency: 'RM',
  payerId: 'p1',
  people: [
    { id: 'p1', name: 'Aisha', amount: 20 },
    { id: 'p2', name: 'Ben', amount: 12.5 },
    { id: 'p3', name: '<script>x</script>', amount: 7.25 },
  ],
};

async function share(env: Env, key: string, body: unknown = { bill: BILL }) {
  const response = await call(env, 'POST', '/shares', { key, body });
  assert.equal(response.status, 201);
  return ((await response.json()) as { id: string }).id;
}

async function paidIds(env: Env, key: string, id: string) {
  const response = await call(env, 'POST', '/shares/status', { key, body: { ids: [id] } });
  assert.equal(response.status, 200);
  const { shares } = (await response.json()) as { shares: Record<string, { paidIds: string[] }> };
  return shares[id]?.paidIds;
}

test('codes are 32 Crockford characters and normalize from how people retype them', () => {
  const code = newSecret();
  assert.equal(code.length, 32);
  assert.equal(isValidCode(code), true);
  const typed = code.toLowerCase().replace(/(.{4})/g, '$1-').replace(/0/g, 'o').replace(/1/g, 'l');
  assert.equal(normalizeCode(typed), code);
  assert.equal(isValidCode('TOO-SHORT'), false);
  assert.match(newShareId(), /^[A-Za-z0-9_-]{22}$/);
});

test('validateBill rejects bad people, amounts and payers', () => {
  assert.equal(validateBill(BILL).ok, true);
  assert.equal(validateBill({ people: [] }).ok, false);
  assert.equal(validateBill({ people: [{ id: 'a', name: 'A', amount: -1 }] }).ok, false);
  assert.equal(validateBill({ people: [{ id: 'a', name: 'A', amount: Number.NaN }] }).ok, false);
  const dupes = [{ id: 'a', name: 'A', amount: 1 }, { id: 'a', name: 'B', amount: 1 }];
  assert.equal(validateBill({ people: dupes }).ok, false);
  assert.equal(validateBill({ ...BILL, payerId: 'nobody' }).ok, false);
});

test('registering a device needs the app token', async () => {
  const env = makeEnv();
  assert.equal((await call(env, 'POST', '/devices')).status, 401);
  assert.equal((await call(env, 'POST', '/devices', { key: 'wrong' })).status, 401);
  assert.equal(isValidCode(await register(env)), true);
});

test('backups round-trip per device and reject bad keys and shapes', async () => {
  const env = makeEnv();
  const key = await register(env);

  assert.equal((await call(env, 'GET', '/backup', { key })).status, 404);
  assert.equal((await call(env, 'GET', '/backup', { key: newSecret() })).status, 401);
  assert.equal((await call(env, 'GET', '/backup')).status, 401);

  const data = { version: 1, groups: [{ id: '1', name: 'Flatmates' }] };
  assert.equal((await call(env, 'PUT', '/backup', { key, body: { data } })).status, 200);

  // The recovery code still works however it's retyped.
  const retyped = key.toLowerCase().replace(/(.{4})/g, '$1 ');
  const restored = await call(env, 'GET', '/backup', { key: retyped });
  assert.equal(restored.status, 200);
  assert.deepEqual(((await restored.json()) as { data: unknown }).data, data);

  assert.equal((await call(env, 'PUT', '/backup', { key, body: { data: { groups: 'nope' } } })).status, 400);
  assert.equal((await call(env, 'PUT', '/backup', { key, body: { nothing: true } })).status, 400);

  const other = await register(env);
  assert.equal((await call(env, 'GET', '/backup', { key: other })).status, 404);
});

test('oversized backups are 413', async () => {
  const env = makeEnv();
  const key = await register(env);
  const huge = { data: { groups: ['x'.repeat(2 * 1024 * 1024)] } };
  assert.equal((await call(env, 'PUT', '/backup', { key, body: huge })).status, 413);
});

test('shares are only visible to and editable by the device that made them', async () => {
  const env = makeEnv();
  const owner = await register(env);
  const stranger = await register(env);
  const id = await share(env, owner, { bill: BILL, paidIds: ['p2', 'p1', 'ghost'] });

  // The payer and unknown ids are dropped from the initial paid list.
  assert.deepEqual(await paidIds(env, owner, id), ['p2']);
  assert.equal(await paidIds(env, stranger, id), undefined);

  const strangerEdit = await call(env, 'PUT', `/shares/${id}`, { key: stranger, body: { bill: BILL } });
  assert.equal(strangerEdit.status, 404);
  const strangerPaid = await call(env, 'PUT', `/shares/${id}/paid`, { key: stranger, body: { personId: 'p3', paid: true } });
  assert.equal(strangerPaid.status, 404);
  assert.equal((await call(env, 'DELETE', `/shares/${id}`, { key: stranger })).status, 404);
});

test('the owner can mark and unmark people, but not the payer', async () => {
  const env = makeEnv();
  const key = await register(env);
  const id = await share(env, key);

  const mark = (personId: string, paid: boolean) =>
    call(env, 'PUT', `/shares/${id}/paid`, { key, body: { personId, paid } });

  assert.equal((await mark('p3', true)).status, 200);
  assert.deepEqual(await paidIds(env, key, id), ['p3']);
  assert.equal((await mark('p3', false)).status, 200);
  assert.deepEqual(await paidIds(env, key, id), []);
  assert.equal((await mark('p1', true)).status, 400);
  assert.equal((await mark('ghost', true)).status, 400);
});

test('changing the payer clears paid-back state, other edits keep it', async () => {
  const env = makeEnv();
  const key = await register(env);
  const id = await share(env, key, { bill: BILL, paidIds: ['p2'] });

  const renamed = { ...BILL, people: BILL.people.map((p) => (p.id === 'p3' ? { ...p, name: 'Chen' } : p)) };
  assert.equal((await call(env, 'PUT', `/shares/${id}`, { key, body: { bill: renamed } })).status, 200);
  assert.deepEqual(await paidIds(env, key, id), ['p2']);

  const newPayer = { ...renamed, payerId: 'p2' };
  assert.equal((await call(env, 'PUT', `/shares/${id}`, { key, body: { bill: newPayer } })).status, 200);
  assert.deepEqual(await paidIds(env, key, id), []);
});

test('the public page escapes names and lets a friend mark themselves paid', async () => {
  const env = makeEnv();
  const key = await register(env);
  const id = await share(env, key);

  const view = await call(env, 'GET', `/s/${id}`);
  assert.equal(view.status, 200);
  assert.match(view.headers.get('Content-Type') ?? '', /text\/html/);
  assert.equal(view.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  const html = await view.text();
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.match(html, /Dinner at &lt;Mamak&gt;/);
  assert.match(html, /RM 12\.50/);
  assert.match(html, /RM 39\.75/);
  // Two "I've paid" buttons: Ben and the third person, not the payer.
  assert.equal(html.match(/name="personId"/g)?.length, 2);

  const paid = await call(env, 'POST', `/s/${id}`, { raw: 'personId=p2' });
  assert.equal(paid.status, 303);
  assert.equal(paid.headers.get('Location'), `/s/${id}?paid=1`);
  assert.deepEqual(await paidIds(env, key, id), ['p2']);

  const after = await (await call(env, 'GET', `/s/${id}?paid=1`)).text();
  assert.match(after, /marked as paid/);
  assert.equal(after.match(/name="personId"/g)?.length, 1);

  // Friends can't mark the payer or someone not on the bill.
  await call(env, 'POST', `/s/${id}`, { raw: 'personId=p1' });
  await call(env, 'POST', `/s/${id}`, { raw: 'personId=ghost' });
  assert.deepEqual(await paidIds(env, key, id), ['p2']);
});

test('deleted and unknown shares show a not-found page', async () => {
  const env = makeEnv();
  const key = await register(env);
  const id = await share(env, key);

  assert.equal((await call(env, 'DELETE', `/shares/${id}`, { key })).status, 204);
  assert.equal((await call(env, 'GET', `/s/${id}`)).status, 404);
  assert.equal((await call(env, 'GET', `/s/${newShareId()}`)).status, 404);
  assert.equal((await call(env, 'GET', '/s/not-a-valid-id')).status, 404);
  assert.equal(await paidIds(env, key, id), undefined);
});

test('data routes are rate limited', async () => {
  const env = makeEnv();
  const key = await register(env);
  const limited = { ...env, DATA_LIMITER: { limit: async () => ({ success: false }) } };
  assert.equal((await call(limited, 'GET', '/backup', { key })).status, 429);
  assert.equal((await call(limited, 'GET', `/s/${newShareId()}`)).status, 429);
});

test('bad share bodies are 400', async () => {
  const env = makeEnv();
  const key = await register(env);
  assert.equal((await call(env, 'POST', '/shares', { key, body: { bill: { people: [] } } })).status, 400);
  assert.equal((await call(env, 'POST', '/shares', { key, body: { bill: BILL, paidIds: 'p2' } })).status, 400);
  const tooMany = { ids: Array.from({ length: 101 }, () => newShareId()) };
  assert.equal((await call(env, 'POST', '/shares/status', { key, body: tooMany })).status, 400);
});
