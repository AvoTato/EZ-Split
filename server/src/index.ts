import Anthropic from '@anthropic-ai/sdk';

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

export type Env = {
  ANTHROPIC_API_KEY: string;
  APP_TOKEN: string;
  ALLOWED_ORIGINS?: string;
  MODEL?: string;
  RATE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
};

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

async function parseReceipt(request: Request, env: Env, cors: Record<string, string>) {
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > MAX_BODY_BYTES) return fail(413, 'too_large', 'Image is too large.', cors);

  const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!env.APP_TOKEN || !safeEqual(bearer, env.APP_TOKEN)) {
    return fail(401, 'unauthorized', 'Missing or invalid token.', cors);
  }

  const client = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.RATE_LIMITER.limit({ key: `${client}:parse-receipt` });
  if (!success) return fail(429, 'rate_limited', 'Too many requests. Try again in a minute.', cors);

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return fail(413, 'too_large', 'Image is too large.', cors);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(400, 'bad_request', 'Body must be JSON.', cors);
  }
  const parsed = parseRequestBody(raw);
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

  const output = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  let receipt = null;
  try {
    receipt = normalizeReceipt(JSON.parse(output));
  } catch {
    receipt = null;
  }
  if (!receipt) return fail(502, 'upstream_error', 'Scanning failed. Try again.', cors);

  return json(receipt, 200, cors);
}

async function draftReminder(request: Request, env: Env, cors: Record<string, string>) {
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > MAX_REMINDER_BODY_BYTES) return fail(413, 'too_large', 'Request is too large.', cors);

  const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!env.APP_TOKEN || !safeEqual(bearer, env.APP_TOKEN)) {
    return fail(401, 'unauthorized', 'Missing or invalid token.', cors);
  }

  const client = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.RATE_LIMITER.limit({ key: `${client}:draft-reminder` });
  if (!success) return fail(429, 'rate_limited', 'Too many requests. Try again in a minute.', cors);

  const text = await request.text();
  if (text.length > MAX_REMINDER_BODY_BYTES) return fail(413, 'too_large', 'Request is too large.', cors);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(400, 'bad_request', 'Body must be JSON.', cors);
  }
  const parsed = parseReminderBody(raw);
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

  const output = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  const message = cleanReminder(output, parsed.value);
  if (!message) return fail(502, 'upstream_error', 'Could not rewrite the message. Try again.', cors);

  return json({ message }, 200, cors);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    const { pathname } = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (pathname === '/parse-receipt') {
      if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', cors);
      return parseReceipt(request, env, cors);
    }

    if (pathname === '/draft-reminder') {
      if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', cors);
      return draftReminder(request, env, cors);
    }

    return fail(404, 'not_found', 'Not found.', cors);
  },
};
