import Anthropic from '@anthropic-ai/sdk';

import { MAX_EXPLAIN_BODY_BYTES, buildExplainPrompt, cleanExplanation, parseExplainBody } from './explain.ts';
import {
  MAX_BODY_BYTES,
  RECEIPT_PROMPT,
  RECEIPT_SCHEMA,
  normalizeReceipt,
  parseRequestBody,
} from './receipt.ts';
import {
  MAX_REMINDER_BODY_BYTES,
  buildReminderPrompt,
  cleanReminder,
  parseReminderBody,
} from './reminder.ts';
import {
  MAX_BACKUP_BYTES,
  MAX_SHARE_BODY_BYTES,
  MAX_STATUS_IDS,
  PAGE_HEADERS,
  SHARE_ID_PATTERN,
  createShare,
  deleteShare,
  deviceFromKey,
  getBackup,
  loadShare,
  paidIdsFor,
  parseBackupBody,
  putBackup,
  registerDevice,
  renderNotFoundPage,
  renderSharePage,
  setPaid,
  updateShare,
  validateBill,
  type DB,
} from './store.ts';

export type Env = {
  ANTHROPIC_API_KEY: string;
  APP_TOKEN: string;
  ALLOWED_ORIGINS?: string;
  MODEL?: string;
  // Strict: AI calls, device registration and the public "I've paid" form.
  RATE_LIMITER: RateLimiter;
  // Looser: backup and shared-bill traffic from the app, and viewing the bill page.
  DATA_LIMITER: RateLimiter;
  DB: DB;
};

type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

const DEFAULT_MODEL = 'claude-haiku-5-5';

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
}

function fail(status: number, error: string, message: string, extra: Record<string, string> = {}) {
  return json({ error, message }, status, extra);
}

// Size check, bearer token, rate limit and JSON parse shared by every endpoint.
// Returns the parsed body, or the error Response to send back.
async function readAuthorizedJson(
  request: Request,
  env: Env,
  cors: Record<string, string>,
  route: string,
  maxBytes: number,
  tooLargeMessage: string
): Promise<{ raw: unknown } | Response> {
  if (declaredTooLarge(request, maxBytes)) return fail(413, 'too_large', tooLargeMessage, cors);

  if (!env.APP_TOKEN || !safeEqual(bearerOf(request), env.APP_TOKEN)) {
    return fail(401, 'unauthorized', 'Missing or invalid token.', cors);
  }

  if (!(await withinRateLimit(request, env.RATE_LIMITER, route))) {
    return fail(429, 'rate_limited', 'Too many requests. Try again in a minute.', cors);
  }

  return readJsonBody(request, cors, maxBytes, tooLargeMessage);
}

function declaredTooLarge(request: Request, maxBytes: number) {
  return Number(request.headers.get('Content-Length') ?? 0) > maxBytes;
}

function bearerOf(request: Request) {
  return request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
}

async function withinRateLimit(request: Request, limiter: RateLimiter, route: string) {
  const client = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await limiter.limit({ key: `${client}:${route}` });
  return success;
}

async function readJsonBody(
  request: Request,
  cors: Record<string, string>,
  maxBytes: number,
  tooLargeMessage: string
): Promise<{ raw: unknown } | Response> {
  const text = await request.text();
  if (text.length > maxBytes) return fail(413, 'too_large', tooLargeMessage, cors);

  try {
    return { raw: JSON.parse(text) };
  } catch {
    return fail(400, 'bad_request', 'Body must be JSON.', cors);
  }
}

// Rate limit, then look up the device behind the bearer key.
async function authorizeDevice(
  request: Request,
  env: Env,
  cors: Record<string, string>,
  route: string
): Promise<{ deviceId: string } | Response> {
  if (!(await withinRateLimit(request, env.DATA_LIMITER, route))) {
    return fail(429, 'rate_limited', 'Too many requests. Try again in a minute.', cors);
  }
  const deviceId = await deviceFromKey(env.DB, bearerOf(request));
  if (!deviceId) return fail(401, 'unauthorized', 'Missing or invalid device key.', cors);
  return { deviceId };
}

function textOf(response: Anthropic.Message) {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

async function parseReceipt(request: Request, env: Env, cors: Record<string, string>) {
  const body = await readAuthorizedJson(request, env, cors, 'parse-receipt', MAX_BODY_BYTES, 'Image is too large.');
  if (body instanceof Response) return body;
  const parsed = parseRequestBody(body.raw);
  if (!parsed.ok) return fail(400, 'bad_request', parsed.error, cors);

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 45_000 });
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: env.MODEL ?? DEFAULT_MODEL,
      max_tokens: 4000,
      output_config: { format: { type: 'json_schema', schema: RECEIPT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: parsed.mediaType, data: parsed.image } },
            { type: 'text', text: RECEIPT_PROMPT },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429 || error.status === 529) {
        return fail(503, 'busy', 'The scanner is busy. Try again shortly.', { 'Retry-After': '10', ...cors });
      }
      if (error.status === 400) return fail(422, 'unreadable_image', "Couldn't read that image.", cors);
    }
    return fail(502, 'upstream_error', 'Scanning failed. Try again.', cors);
  }

  if (response.stop_reason === 'refusal') return fail(422, 'refused', "Couldn't read that image.", cors);
  if (response.stop_reason === 'max_tokens') return fail(502, 'upstream_error', 'Scanning failed. Try again.', cors);

  let receipt = null;
  try {
    receipt = normalizeReceipt(JSON.parse(textOf(response)));
  } catch {
    receipt = null;
  }
  if (!receipt) return fail(502, 'upstream_error', 'Scanning failed. Try again.', cors);

  return json(receipt, 200, cors);
}

async function draftReminder(request: Request, env: Env, cors: Record<string, string>) {
  const body = await readAuthorizedJson(
    request,
    env,
    cors,
    'draft-reminder',
    MAX_REMINDER_BODY_BYTES,
    'Request is too large.'
  );
  if (body instanceof Response) return body;
  const parsed = parseReminderBody(body.raw);
  if (!parsed.ok) return fail(400, 'bad_request', parsed.error, cors);

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 20_000 });
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: env.MODEL ?? DEFAULT_MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: buildReminderPrompt(parsed.value) }],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError && (error.status === 429 || error.status === 529)) {
      return fail(503, 'busy', 'The assistant is busy. Try again shortly.', { 'Retry-After': '10', ...cors });
    }
    return fail(502, 'upstream_error', 'Could not rewrite the message. Try again.', cors);
  }

  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
    return fail(502, 'upstream_error', 'Could not rewrite the message. Try again.', cors);
  }

  const message = cleanReminder(textOf(response), parsed.value);
  if (!message) return fail(502, 'upstream_error', 'Could not rewrite the message. Try again.', cors);

  return json({ message }, 200, cors);
}

async function explainSplit(request: Request, env: Env, cors: Record<string, string>) {
  const body = await readAuthorizedJson(
    request,
    env,
    cors,
    'explain-split',
    MAX_EXPLAIN_BODY_BYTES,
    'Request is too large.'
  );
  if (body instanceof Response) return body;
  const parsed = parseExplainBody(body.raw);
  if (!parsed.ok) return fail(400, 'bad_request', parsed.error, cors);

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 20_000 });
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: env.MODEL ?? DEFAULT_MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: buildExplainPrompt(parsed.value) }],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError && (error.status === 429 || error.status === 529)) {
      return fail(503, 'busy', 'The assistant is busy. Try again shortly.', { 'Retry-After': '10', ...cors });
    }
    return fail(502, 'upstream_error', 'Could not explain the split. Try again.', cors);
  }

  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
    return fail(502, 'upstream_error', 'Could not explain the split. Try again.', cors);
  }

  const explanation = cleanExplanation(textOf(response), parsed.value);
  if (!explanation) return fail(502, 'upstream_error', 'Could not explain the split. Try again.', cors);

  return json({ explanation }, 200, cors);
}

// ---------- Devices and backups ----------

async function registerDeviceRoute(request: Request, env: Env, cors: Record<string, string>) {
  if (!env.APP_TOKEN || !safeEqual(bearerOf(request), env.APP_TOKEN)) {
    return fail(401, 'unauthorized', 'Missing or invalid token.', cors);
  }
  if (!(await withinRateLimit(request, env.RATE_LIMITER, 'devices'))) {
    return fail(429, 'rate_limited', 'Too many requests. Try again in a minute.', cors);
  }
  const key = await registerDevice(env.DB);
  return json({ key }, 201, cors);
}

async function backupRoute(request: Request, env: Env, cors: Record<string, string>) {
  if (request.method === 'PUT' && declaredTooLarge(request, MAX_BACKUP_BYTES)) {
    return fail(413, 'too_large', 'Backup is too large.', cors);
  }
  const auth = await authorizeDevice(request, env, cors, 'backup');
  if (auth instanceof Response) return auth;

  if (request.method === 'GET') {
    const backup = await getBackup(env.DB, auth.deviceId);
    if (!backup) return fail(404, 'not_found', 'No backup yet.', cors);
    return json(backup, 200, cors);
  }

  const body = await readJsonBody(request, cors, MAX_BACKUP_BYTES, 'Backup is too large.');
  if (body instanceof Response) return body;
  const parsed = parseBackupBody(body.raw);
  if (!parsed.ok) return fail(400, 'bad_request', parsed.error, cors);
  const updatedAt = await putBackup(env.DB, auth.deviceId, parsed.text);
  return json({ updatedAt }, 200, cors);
}

// ---------- Shared bills (owner side) ----------

function stringList(value: unknown, max: number) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) return null;
  return value.every((item) => typeof item === 'string') ? (value as string[]) : null;
}

async function createShareRoute(request: Request, env: Env, cors: Record<string, string>) {
  if (declaredTooLarge(request, MAX_SHARE_BODY_BYTES)) return fail(413, 'too_large', 'Bill is too large.', cors);
  const auth = await authorizeDevice(request, env, cors, 'shares');
  if (auth instanceof Response) return auth;
  const body = await readJsonBody(request, cors, MAX_SHARE_BODY_BYTES, 'Bill is too large.');
  if (body instanceof Response) return body;

  const record = (typeof body.raw === 'object' && body.raw !== null ? body.raw : {}) as Record<string, unknown>;
  const bill = validateBill(record.bill);
  if (!bill.ok) return fail(400, 'bad_request', bill.error, cors);
  const paidIds = stringList(record.paidIds, 50);
  if (!paidIds) return fail(400, 'bad_request', 'paidIds must be a list of person ids.', cors);

  const id = await createShare(env.DB, auth.deviceId, bill.value, paidIds);
  return json({ id }, 201, cors);
}

// Paid-back state for several of this device's shares in one request.
// Shares that are gone or belong to another device are left out.
async function shareStatusRoute(request: Request, env: Env, cors: Record<string, string>) {
  if (declaredTooLarge(request, MAX_SHARE_BODY_BYTES)) return fail(413, 'too_large', 'Request is too large.', cors);
  const auth = await authorizeDevice(request, env, cors, 'shares');
  if (auth instanceof Response) return auth;
  const body = await readJsonBody(request, cors, MAX_SHARE_BODY_BYTES, 'Request is too large.');
  if (body instanceof Response) return body;

  const record = (typeof body.raw === 'object' && body.raw !== null ? body.raw : {}) as Record<string, unknown>;
  const ids = stringList(record.ids, MAX_STATUS_IDS);
  if (!ids) return fail(400, 'bad_request', `ids must be a list of up to ${MAX_STATUS_IDS} share ids.`, cors);

  const shares: Record<string, { paidIds: string[] }> = {};
  for (const id of new Set(ids)) {
    const share = await loadShare(env.DB, id);
    if (!share || share.deviceId !== auth.deviceId) continue;
    shares[id] = { paidIds: await paidIdsFor(env.DB, id, share.bill) };
  }
  return json({ shares }, 200, cors);
}

async function ownShareRoute(
  request: Request,
  env: Env,
  cors: Record<string, string>,
  id: string,
  action: 'bill' | 'paid'
) {
  if (declaredTooLarge(request, MAX_SHARE_BODY_BYTES)) return fail(413, 'too_large', 'Bill is too large.', cors);
  const auth = await authorizeDevice(request, env, cors, 'shares');
  if (auth instanceof Response) return auth;

  const share = await loadShare(env.DB, id);
  if (!share || share.deviceId !== auth.deviceId) return fail(404, 'not_found', 'Share not found.', cors);

  if (request.method === 'DELETE' && action === 'bill') {
    await deleteShare(env.DB, id);
    return new Response(null, { status: 204, headers: cors });
  }

  const body = await readJsonBody(request, cors, MAX_SHARE_BODY_BYTES, 'Bill is too large.');
  if (body instanceof Response) return body;
  const record = (typeof body.raw === 'object' && body.raw !== null ? body.raw : {}) as Record<string, unknown>;

  if (action === 'bill') {
    const bill = validateBill(record.bill);
    if (!bill.ok) return fail(400, 'bad_request', bill.error, cors);
    await updateShare(env.DB, id, share.bill, bill.value);
    return json({ ok: true }, 200, cors);
  }

  const { personId, paid } = record;
  if (typeof personId !== 'string' || typeof paid !== 'boolean') {
    return fail(400, 'bad_request', 'Send personId and paid.', cors);
  }
  if (!(await setPaid(env.DB, id, share.bill, personId, paid))) {
    return fail(400, 'bad_request', 'That person cannot be marked paid on this bill.', cors);
  }
  return json({ ok: true }, 200, cors);
}

// ---------- Shared bills (public page) ----------

function page(body: string, status: number, extra: Record<string, string> = {}) {
  return new Response(body, { status, headers: { ...PAGE_HEADERS, ...extra } });
}

async function sharePageRoute(request: Request, env: Env, id: string, url: URL) {
  const limiter = request.method === 'POST' ? env.RATE_LIMITER : env.DATA_LIMITER;
  if (!(await withinRateLimit(request, limiter, request.method === 'POST' ? 'page-paid' : 'page'))) {
    return page('<!doctype html><title>Slow down</title><p>Too many requests. Try again in a minute.</p>', 429);
  }

  const share = await loadShare(env.DB, id);
  if (!share) return page(renderNotFoundPage(), 404);

  if (request.method === 'POST') {
    if (declaredTooLarge(request, 1024)) return page(renderNotFoundPage(), 413);
    const text = await request.text();
    const personId = text.length <= 1024 ? new URLSearchParams(text).get('personId') : null;
    // Friends can only mark paid, never un-mark: undoing is left to the owner's app.
    if (personId) await setPaid(env.DB, id, share.bill, personId, true);
    return new Response(null, { status: 303, headers: { Location: `/s/${id}?paid=1`, 'Cache-Control': 'no-store' } });
  }

  const paidIds = await paidIdsFor(env.DB, id, share.bill);
  const flash = url.searchParams.get('paid') === '1' ? "Thanks! You're marked as paid." : undefined;
  return page(renderSharePage(share.bill, paidIds, flash), 200);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);
    const { pathname } = url;
    const { method } = request;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (pathname === '/devices') {
      if (method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', cors);
      return registerDeviceRoute(request, env, cors);
    }

    if (pathname === '/backup') {
      if (method !== 'GET' && method !== 'PUT') return fail(405, 'method_not_allowed', 'Use GET or PUT.', cors);
      return backupRoute(request, env, cors);
    }

    if (pathname === '/shares') {
      if (method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', cors);
      return createShareRoute(request, env, cors);
    }

    if (pathname === '/shares/status') {
      if (method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', cors);
      return shareStatusRoute(request, env, cors);
    }

    const ownShare = pathname.match(/^\/shares\/([^/]+)(\/paid)?$/);
    if (ownShare && SHARE_ID_PATTERN.test(ownShare[1])) {
      const action = ownShare[2] ? 'paid' : 'bill';
      const allowed = action === 'paid' ? method === 'PUT' : method === 'PUT' || method === 'DELETE';
      if (!allowed) return fail(405, 'method_not_allowed', action === 'paid' ? 'Use PUT.' : 'Use PUT or DELETE.', cors);
      return ownShareRoute(request, env, cors, ownShare[1], action);
    }

    const sharePage = pathname.match(/^\/s\/([^/]+)$/);
    if (sharePage) {
      if (!SHARE_ID_PATTERN.test(sharePage[1])) return page(renderNotFoundPage(), 404);
      if (method !== 'GET' && method !== 'POST') return fail(405, 'method_not_allowed', 'Use GET or POST.');
      return sharePageRoute(request, env, sharePage[1], url);
    }

    if (pathname === '/parse-receipt') {
      if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', cors);
      return parseReceipt(request, env, cors);
    }

    if (pathname === '/draft-reminder') {
      if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', cors);
      return draftReminder(request, env, cors);
    }

    if (pathname === '/explain-split') {
      if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', cors);
      return explainSplit(request, env, cors);
    }

    return fail(404, 'not_found', 'Not found.', cors);
  },
};
