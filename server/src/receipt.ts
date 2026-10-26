export type ReceiptItem = {
  name: string;
  price: number;
  qty: number;
};

export type ParsedReceipt = {
  items: ReceiptItem[];
  subtotal: number | null;
  discount: number | null;
  serviceCharge: number | null;
  tax: number | null;
  total: number | null;
  needsReview: boolean;
};

export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_BODY_BYTES = 8 * 1024 * 1024;

const NULLABLE_AMOUNT = { type: ['number', 'null'] };

export const RECEIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'subtotal', 'discount', 'serviceCharge', 'tax', 'total'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'price', 'qty'],
        properties: {
          name: { type: 'string' },
          price: { type: 'number' },
          qty: { type: 'integer' },
        },
      },
    },
    subtotal: NULLABLE_AMOUNT,
    discount: NULLABLE_AMOUNT,
    serviceCharge: NULLABLE_AMOUNT,
    tax: NULLABLE_AMOUNT,
    total: NULLABLE_AMOUNT,
  },
};

export const RECEIPT_PROMPT = `Extract this restaurant receipt into JSON.
Rules:
- items: one entry per ordered line. "price" is the printed LINE TOTAL for that line (not the unit price). "qty" is the quantity ordered on that line (default 1).
- Lines that only describe options of the previous item (for example Cheese, Knife Cut, Iced, add-on notes without their own price) are NOT separate items. A line with its own price, including an "ADD ON" line, is an item.
- Do not include subtotal, discount, service charge, tax, rounding adjustment, total, payment or change lines as items.
- Keep zero-priced ordered lines as items with price 0.
- subtotal: the printed subtotal. serviceCharge and tax: the printed amounts (service tax / SST / GST all count as tax unless a separate service charge line exists). total: the final amount payable (after rounding).
- discount: the total discount as a POSITIVE amount, or null if the receipt has none.
- Use null for anything not printed or not readable. Never guess or compute numbers that are not printed.
- Item names in English as printed; drop Chinese text.`;

export type RequestParse =
  | { ok: true; image: string; mediaType: MediaType }
  | { ok: false; error: string };

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function decodedSize(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function parseRequestBody(raw: unknown): RequestParse {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Body must be a JSON object.' };
  const { image, mediaType } = raw as Record<string, unknown>;
  if (typeof image !== 'string' || image.length === 0) return { ok: false, error: 'Missing image.' };
  if (typeof mediaType !== 'string' || !(MEDIA_TYPES as readonly string[]).includes(mediaType)) {
    return { ok: false, error: 'mediaType must be image/jpeg, image/png or image/webp.' };
  }
  if (!BASE64_RE.test(image) || image.length % 4 !== 0) return { ok: false, error: 'image must be base64.' };
  if (decodedSize(image) > MAX_IMAGE_BYTES) return { ok: false, error: 'Image is larger than 5 MB.' };
  return { ok: true, image, mediaType: mediaType as MediaType };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function amountOrNull(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return round2(value);
}

export function normalizeReceipt(raw: unknown): ParsedReceipt | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.items)) return null;

  const items: ReceiptItem[] = [];
  for (const entry of record.items) {
    if (typeof entry !== 'object' || entry === null) return null;
    const { name, price, qty } = entry as Record<string, unknown>;
    if (typeof name !== 'string' || typeof price !== 'number' || !Number.isFinite(price)) return null;
    const quantity = typeof qty === 'number' && Number.isInteger(qty) && qty >= 1 ? qty : 1;
    items.push({ name: name.trim(), price: round2(price), qty: quantity });
  }

  const subtotal = amountOrNull(record.subtotal);
  const discount = amountOrNull(record.discount);
  const serviceCharge = amountOrNull(record.serviceCharge);
  const tax = amountOrNull(record.tax);
  const total = amountOrNull(record.total);
  if ([subtotal, discount, serviceCharge, tax, total].includes(undefined)) return null;

  return {
    items,
    subtotal: subtotal as number | null,
    discount: discount === null || discount === undefined ? null : Math.abs(discount),
    serviceCharge: serviceCharge as number | null,
    tax: tax as number | null,
    total: total as number | null,
    needsReview: false,
  };
}
