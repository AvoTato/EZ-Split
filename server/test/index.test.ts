import assert from 'node:assert/strict';
import { test } from 'node:test';

import worker, { safeEqual, type Env } from '../src/index.ts';

const TINY = Buffer.from('hello receipt').toString('base64');

const makeEnv = (overrides: Partial<Env> = {}): Env => ({
  ANTHROPIC_API_KEY: 'test-key',
  APP_TOKEN: 'secret-token',
  ALLOWED_ORIGINS: 'http://localhost:8081',
  RATE_LIMITER: { limit: async () => ({ success: true }) },
  ...overrides,
});

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://api.test/parse-receipt', {
    method: 'POST',
    headers: { Authorization: 'Bearer secret-token', 'Content-Type': 'application/json', ...headers },
    body,
  });

test('safeEqual compares strings of any length', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('', ''), true);
});

test('unknown paths are 404 and wrong methods are 405', async () => {
  assert.equal((await worker.fetch(new Request('https://api.test/nope'), makeEnv())).status, 404);
  assert.equal((await worker.fetch(new Request('https://api.test/parse-receipt'), makeEnv())).status, 405);
});

test('missing or wrong token is 401 and never reaches the model', async () => {
  const body = JSON.stringify({ image: TINY, mediaType: 'image/jpeg' });
  const missing = new Request('https://api.test/parse-receipt', { method: 'POST', body });
  assert.equal((await worker.fetch(missing, makeEnv())).status, 401);
  const wrong = await worker.fetch(post(body, { Authorization: 'Bearer nope' }), makeEnv());
  assert.equal(wrong.status, 401);
  const noServerToken = await worker.fetch(post(body), makeEnv({ APP_TOKEN: '' }));
  assert.equal(noServerToken.status, 401);
});

test('rate limited requests get 429', async () => {
  const env = makeEnv({ RATE_LIMITER: { limit: async () => ({ success: false }) } });
  const response = await worker.fetch(post(JSON.stringify({ image: TINY, mediaType: 'image/jpeg' })), env);
  assert.equal(response.status, 429);
});

test('oversized bodies are 413', async () => {
  const response = await worker.fetch(post('{}', { 'Content-Length': String(9 * 1024 * 1024) }), makeEnv());
  assert.equal(response.status, 413);
});

test('bad JSON and bad fields are 400', async () => {
  assert.equal((await worker.fetch(post('not json'), makeEnv())).status, 400);
  const badType = JSON.stringify({ image: TINY, mediaType: 'text/plain' });
  assert.equal((await worker.fetch(post(badType), makeEnv())).status, 400);
});

test('CORS headers only go to allowed origins', async () => {
  const preflight = (origin: string) =>
    worker.fetch(new Request('https://api.test/parse-receipt', { method: 'OPTIONS', headers: { Origin: origin } }), makeEnv());
  const allowed = await preflight('http://localhost:8081');
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8081');
  const denied = await preflight('https://evil.example');
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
});

test('explain-split needs POST, a token and a valid body before reaching the model', async () => {
  const url = 'https://api.test/explain-split';
  assert.equal((await worker.fetch(new Request(url), makeEnv())).status, 405);
  const noToken = new Request(url, { method: 'POST', body: '{}' });
  assert.equal((await worker.fetch(noToken, makeEnv())).status, 401);
  const badBody = new Request(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer secret-token' },
    body: JSON.stringify({ people: [] }),
  });
  assert.equal((await worker.fetch(badBody, makeEnv())).status, 400);
});
