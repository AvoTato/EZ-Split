import type { ParsedReceipt } from './parseReceipt';

export type ScanErrorCode =
  | 'not_configured'
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'rate_limited'
  | 'busy'
  | 'refused'
  | 'unreadable_image'
  | 'too_large'
  | 'upstream_error'
  | 'bad_response'
  | 'empty';

export class ScanError extends Error {
  code: ScanErrorCode;

  constructor(code: ScanErrorCode, message: string) {
    super(message);
    this.name = 'ScanError';
    this.code = code;
  }
}

export type MediaType = 'image/jpeg' | 'image/png' | 'image/webp';

const REQUEST_TIMEOUT_MS = 40_000;

const SERVER_CODES: Record<string, ScanErrorCode> = {
  unauthorized: 'unauthorized',
  rate_limited: 'rate_limited',
  busy: 'busy',
  refused: 'refused',
  unreadable_image: 'unreadable_image',
  too_large: 'too_large',
  upstream_error: 'upstream_error',
};

const STATUS_CODES: Record<number, ScanErrorCode> = {
  401: 'unauthorized',
  413: 'too_large',
  422: 'unreadable_image',
  429: 'rate_limited',
  503: 'busy',
};

export function detectMediaType(base64: string): MediaType {
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

function isAmount(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function toReceipt(data: unknown): ParsedReceipt | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  if (!Array.isArray(record.items)) return null;

  const items: ParsedReceipt['items'] = [];
  for (const entry of record.items) {
    if (typeof entry !== 'object' || entry === null) return null;
    const { name, price, qty } = entry as Record<string, unknown>;
    if (typeof name !== 'string' || typeof price !== 'number' || !Number.isFinite(price)) return null;
    items.push({ name, price, qty: typeof qty === 'number' && qty >= 1 ? qty : 1 });
  }

  const { subtotal, discount, serviceCharge, tax, total } = record;
  if (![subtotal, discount, serviceCharge, tax, total].every(isAmount)) return null;

  return {
    items,
    subtotal: subtotal as number | null,
    discount: discount as number | null,
    serviceCharge: serviceCharge as number | null,
    tax: tax as number | null,
    total: total as number | null,
    needsReview: false,
  };
}

function errorFromResponse(status: number, body: unknown): ScanError {
  const serverCode =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>).error : undefined;
  const code =
    (typeof serverCode === 'string' ? SERVER_CODES[serverCode] : undefined) ??
    STATUS_CODES[status] ??
    'upstream_error';
  return new ScanError(code, `Receipt scan failed (${status}).`);
}

export async function parseReceiptImage(base64: string): Promise<ParsedReceipt> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  const token = process.env.EXPO_PUBLIC_API_TOKEN;
  if (!baseUrl || !token) {
    throw new ScanError('not_configured', 'EXPO_PUBLIC_API_URL and EXPO_PUBLIC_API_TOKEN are not set.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/+$/, '')}/parse-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image: base64, mediaType: detectMediaType(base64) }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new ScanError('timeout', 'Receipt scan timed out.');
    throw new ScanError('network', error instanceof Error ? error.message : 'Network request failed.');
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) throw errorFromResponse(response.status, body);

  const receipt = toReceipt(body);
  if (!receipt) throw new ScanError('bad_response', 'Receipt scan returned an unexpected response.');
  if (receipt.items.length === 0 && receipt.total === null) {
    throw new ScanError('empty', 'No receipt was recognized in that image.');
  }
  return receipt;
}
