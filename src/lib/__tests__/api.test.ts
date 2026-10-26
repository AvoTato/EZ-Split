import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { ScanError, detectMediaType, parseReceiptImage } from '../api.ts';

const URL_BASE = 'https://api.example.test';
const TOKEN = 'test-token-123';

const originalFetch = globalThis.fetch;
const originalUrl = process.env.EXPO_PUBLIC_API_URL;
const originalToken = process.env.EXPO_PUBLIC_API_TOKEN;

type FetchCall = { url: string; init: RequestInit };
let calls: FetchCall[] = [];

function stubFetch(respond: () => Response | Promise<Response>) {
  calls = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return respond();
  }) as typeof fetch;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const goodBody = {
  items: [
    { name: 'Nasi Lemak', price: 12, qty: 1 },
    { name: 'Teh Tarik', price: 7, qty: 2 },
  ],
  subtotal: 19,
  discount: null,
  serviceCharge: null,
  tax: 1.14,
  total: 20.14,
  needsReview: false,
};

const failureCode = async () => {
  try {
    await parseReceiptImage('/9j/AAAA');
  } catch (error) {
    assert.ok(error instanceof ScanError);
    return error.code;
  }
  assert.fail('expected a ScanError');
};

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = URL_BASE;
  process.env.EXPO_PUBLIC_API_TOKEN = TOKEN;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = originalUrl;
  if (originalToken === undefined) delete process.env.EXPO_PUBLIC_API_TOKEN;
  else process.env.EXPO_PUBLIC_API_TOKEN = originalToken;
});

test('detectMediaType recognises jpeg, png and webp by their base64 prefix', () => {
  assert.equal(detectMediaType('/9j/4AAQ'), 'image/jpeg');
  assert.equal(detectMediaType('iVBORw0KGgo'), 'image/png');
  assert.equal(detectMediaType('UklGRiQAAABXRUJQ'), 'image/webp');
  assert.equal(detectMediaType('something-else'), 'image/jpeg');
});

test('returns the scanned receipt and sends a correct authorised request', async () => {
  stubFetch(() => jsonResponse(goodBody));
  const receipt = await parseReceiptImage('/9j/AAAA');
  assert.deepEqual(receipt, goodBody);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${URL_BASE}/parse-receipt`);
  assert.equal(calls[0].init.method, 'POST');
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { image: '/9j/AAAA', mediaType: 'image/jpeg' });
});

test('tolerates a trailing slash on the base url', async () => {
  process.env.EXPO_PUBLIC_API_URL = `${URL_BASE}///`;
  stubFetch(() => jsonResponse(goodBody));
  await parseReceiptImage('/9j/AAAA');
  assert.equal(calls[0].url, `${URL_BASE}/parse-receipt`);
});

test('fixes up missing or invalid quantities and always returns needsReview false', async () => {
  stubFetch(() =>
    jsonResponse({ ...goodBody, needsReview: true, items: [{ name: 'Roti', price: 3, qty: 0 }] })
  );
  const receipt = await parseReceiptImage('/9j/AAAA');
  assert.deepEqual(receipt.items, [{ name: 'Roti', price: 3, qty: 1 }]);
  assert.equal(receipt.needsReview, false);
});

test('missing configuration is reported without calling the network', async () => {
  delete process.env.EXPO_PUBLIC_API_TOKEN;
  stubFetch(() => jsonResponse(goodBody));
  assert.equal(await failureCode(), 'not_configured');
  assert.equal(calls.length, 0);
});

test('server error codes map to ScanError codes', async () => {
  const cases: [number, string, string][] = [
    [401, 'unauthorized', 'unauthorized'],
    [429, 'rate_limited', 'rate_limited'],
    [503, 'busy', 'busy'],
    [422, 'refused', 'refused'],
    [422, 'unreadable_image', 'unreadable_image'],
    [413, 'too_large', 'too_large'],
    [502, 'upstream_error', 'upstream_error'],
  ];
  for (const [status, error, expected] of cases) {
    stubFetch(() => jsonResponse({ error, message: 'x' }, status));
    assert.equal(await failureCode(), expected, `${status} ${error}`);
  }
});

test('falls back to the status code when the body is not JSON', async () => {
  stubFetch(() => new Response('<html>bad gateway</html>', { status: 502 }));
  assert.equal(await failureCode(), 'upstream_error');
  stubFetch(() => new Response('nope', { status: 401 }));
  assert.equal(await failureCode(), 'unauthorized');
  stubFetch(() => new Response('', { status: 418 }));
  assert.equal(await failureCode(), 'upstream_error');
});

test('a network failure is a network ScanError', async () => {
  stubFetch(() => {
    throw new TypeError('fetch failed');
  });
  assert.equal(await failureCode(), 'network');
});

test('a hung request times out', async () => {
  globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })) as typeof fetch;
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((fn: () => void) => realSetTimeout(fn, 5)) as typeof setTimeout;
  try {
    assert.equal(await failureCode(), 'timeout');
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
});

test('malformed or empty successful responses are rejected', async () => {
  stubFetch(() => jsonResponse({ items: 'nope' }));
  assert.equal(await failureCode(), 'bad_response');
  stubFetch(() => jsonResponse({ ...goodBody, total: 'free' }));
  assert.equal(await failureCode(), 'bad_response');
  stubFetch(() => jsonResponse(null));
  assert.equal(await failureCode(), 'bad_response');
  stubFetch(() => jsonResponse({ ...goodBody, items: [], total: null }));
  assert.equal(await failureCode(), 'empty');
});

test('error messages never contain the token or the image', async () => {
  stubFetch(() => jsonResponse({ error: 'unauthorized', message: 'x' }, 401));
  try {
    await parseReceiptImage('/9j/SECRETIMAGE');
    assert.fail('expected a ScanError');
  } catch (error) {
    assert.ok(error instanceof ScanError);
    assert.ok(!error.message.includes(TOKEN));
    assert.ok(!error.message.includes('SECRETIMAGE'));
  }
});
