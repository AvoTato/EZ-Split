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
  required: ['items', 'subtotal', 'discount', 'serviceCharge', 'tax', 'rounding', 'total'],
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
    rounding: NULLABLE_AMOUNT,
    total: NULLABLE_AMOUNT,
  },
};

export const RECEIPT_PROMPT = `Extract this restaurant receipt into JSON.
Rules:
- items: one entry per ordered line. "price" is the printed LINE TOTAL for that line (not the unit price). "qty" is the quantity ordered on that line (default 1).
- Lines that only describe options of the previous item (for example Cheese, Knife Cut, Iced, add-on notes without their own price) are NOT separate items. A line with its own price, including an "ADD ON" line, is an item.
- Do not include subtotal, discount, service charge, tax, rounding adjustment, total, payment or change lines as items.
- Keep zero-priced ordered lines as items with price 0.
- A line printed with a minus sign or a negative amount (for example "-0.38" under an item) is an item with a NEGATIVE price. Keep it in the order printed, right after the item it follows.
- subtotal: the printed subtotal. serviceCharge and tax: the printed amounts (service tax / SST / GST all count as tax unless a separate service charge line exists). Use the tax amount itself (for example "6% Service Tax 2.44"), never a total that includes tax.
- total: the final amount payable (after rounding), for example "Total" or "Eat-In Total (incl Tax)". Never use a payment method line (card, cash) or a tax line as the total.
- discount: the total discount as a POSITIVE amount, or null if the receipt has none.
- rounding: the printed rounding adjustment (for example "Rounding 0.01" or "-0.02"), or null.
- In the totals section the labels and amounts are two columns that may not line up horizontally when the photo is angled. Pair them in order, top to bottom: the first label with the first amount, the second with the second, and so on.
- Check your reading: subtotal - discount + serviceCharge + tax + rounding should equal total, and total usually equals the payment amount (card, e-wallet, cash). If it doesn't add up, re-pair the totals section before answering.
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
  const rounding = amountOrNull(record.rounding);
  const total = amountOrNull(record.total);
  if ([subtotal, discount, serviceCharge, tax, rounding, total].includes(undefined)) return null;

  const receipt: ParsedReceipt = {
    items,
    subtotal: subtotal as number | null,
    discount: discount === null || discount === undefined ? null : Math.abs(discount),
    serviceCharge: serviceCharge as number | null,
    tax: tax as number | null,
    total: total as number | null,
    needsReview: false,
  };
  return repairTotal(receipt, rounding ?? null);
}

// On an angled photo "Total" can get paired with the rounding amount (e.g. 0.01). When the
// total is rounding-sized, doesn't add up, and the other amounts look sane, rebuild it.
// Mirrors repairTotal in the app's receiptReview.ts.
export function repairTotal(receipt: ParsedReceipt, rounding: number | null): ParsedReceipt {
  const { total, subtotal, discount, tax, serviceCharge } = receipt;
  if (total === null || Math.abs(total) > 0.1) return receipt;
  const itemsSum = receipt.items.reduce((sum, item) => sum + item.price, 0);
  const off = discount ?? 0;
  const base =
    subtotal === null
      ? itemsSum - off
      : off && Math.abs(itemsSum - off - subtotal) <= 0.01
        ? subtotal
        : subtotal - off;
  const expected = base + (tax ?? 0) + (serviceCharge ?? 0);
  if (expected <= 1 || base <= 0 || Math.abs(total - expected) <= 0.1) return receipt;
  const sane = (fee: number | null) => fee === null || (fee >= 0 && fee <= base * 0.25);
  if (!sane(tax) || !sane(serviceCharge)) return receipt;
  return { ...receipt, total: round2(expected + (rounding ?? total)) };
}
