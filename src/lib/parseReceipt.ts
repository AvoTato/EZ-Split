export type ReceiptItem = {
  name: string;
  price: number;
};

export type ParsedReceipt = {
  items: ReceiptItem[];
  subtotal: number | null;
  serviceCharge: number | null;
  tax: number | null;
  total: number | null;
};

export async function callGoogleVisionOCR(base64Image: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_GOOGLE_VISION_API_KEY. Add it to a .env file to enable receipt scanning.'
    );
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Google Vision request failed.');
  }

  const text = data?.responses?.[0]?.fullTextAnnotation?.text;
  if (!text) {
    throw new Error('No text detected in the receipt image.');
  }
  return text;
}

const PRICE_RE = /((?:\d{1,3}(?:,\d{3})+|\d+)[.,]\d{2})\s*$/;
const LEADING_QTY_RE = /^\s*\d+\s*[xX]?\s*/;
const UNIT_PRICE_RE = /\s*[àA@]\s*\d+[.,]\d{2}\s*[A-Za-z]{0,4}\s*/g;
const ROUNDING_RE = /(rnd|round)/;

function toNumber(raw: string): number {
  // Strip thousands separators, then normalize the decimal comma (e.g. "1,234.50" or "1.234,50").
  return parseFloat(raw.replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.'));
}

/**
 * Best-effort heuristic parser for OCR'd receipt text. Receipt layouts vary a lot
 * (see the Berghotel vs. TGIF example receipts), so these rules are a prototype
 * starting point, not a robust parser — expect to tune them against real receipts.
 */
export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const result: ParsedReceipt = {
    items: [],
    subtotal: null,
    serviceCharge: null,
    tax: null,
    total: null,
  };

  for (const line of lines) {
    const lower = line.toLowerCase();
    const priceMatch = line.match(PRICE_RE);
    if (!priceMatch) continue;
    const price = toNumber(priceMatch[1]);

    if (lower.includes('subtotal')) {
      result.subtotal = price;
      continue;
    }
    if (ROUNDING_RE.test(lower)) {
      // Rounding-adjustment lines (e.g. "Rnd Adj") aren't a purchasable item, tax, or the total.
      continue;
    }
    if (lower.includes('%') && /(svc|service|chg)/.test(lower)) {
      result.serviceCharge = price;
      continue;
    }
    if (lower.includes('%') && /(sst|vat|tax|gst|mwst)/.test(lower)) {
      result.tax = price;
      continue;
    }
    if (lower.includes('total') || /\bttl\b/.test(lower) || lower.includes('amount due')) {
      // Later "total"-like lines (e.g. a post-rounding "Ttl Aft Rnd") override earlier ones,
      // so the final total reflects the most authoritative figure on the receipt.
      result.total = price;
      continue;
    }

    const name = line
      .slice(0, priceMatch.index)
      .replace(UNIT_PRICE_RE, ' ')
      .replace(LEADING_QTY_RE, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (name) {
      result.items.push({ name, price });
    }
  }

  return result;
}
