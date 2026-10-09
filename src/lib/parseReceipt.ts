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

const PRICE_RE = /((?:\d{1,3}(?:,\d{3})+|\d+)[.,]\d{2})\s*[A-Za-z]{0,3}\s*$/;
const PRICE_ONLY_RE = /^[^\d]{0,6}(?:\d{1,3}(?:,\d{3})+|\d+)[.,]\d{2}\s*[A-Za-z]{0,3}\s*$/;
const LEADING_QTY_RE = /^\s*(?:\d+\s*[xX]\s*|[xX]\s*\d+\s*)/;
const UNIT_PRICE_RE = /\s*[àA@]\s*\d+[.,]\d{2}\s*[A-Za-z]{0,4}\s*/g;
const TRAILING_CURRENCY_RE = /\s*(RM|MYR|SGD|USD|CHF|EUR|GBP|\$|€|£)\s*$/i;
const ROUNDING_RE = /(rnd|round)/;
const SERVICE_CHARGE_RE = /(svc|service).*(chg|charge)|(chg|charge).*(svc|service)/;
const TAX_RE = /(sst|vat|tax|gst|mwst)/;
const PAYMENT_METHOD_RE = /\b(visa|mastercard|master card|amex|cash|debit|nets|grabpay|touch\s*n\s*go|tng|paynow|alipay)\b/;
const STARTS_WITH_QTY_RE = /^\s*(?:\d|[xX]\s*\d)/;
const TOTAL_LABEL_RE = /total|\bttl\b|amount due/;
const SUBTOTAL_RE = /sub\s*-?\s*total/;

function isMergeableLabel(line: string): boolean {
  if (STARTS_WITH_QTY_RE.test(line) && /[A-Za-z]/.test(line)) return true;
  const lower = line.toLowerCase();
  return (
    SUBTOTAL_RE.test(lower) ||
    TOTAL_LABEL_RE.test(lower) ||
    TAX_RE.test(lower) ||
    SERVICE_CHARGE_RE.test(lower) ||
    ROUNDING_RE.test(lower) ||
    PAYMENT_METHOD_RE.test(lower)
  );
}

const BARE_QTY_LINE_RE = /^\d{1,2}$/;

const PRICE_WITH_SUFFIX_RE = /((?:\d{1,3}(?:,\d{3})+|\d+)[.,]\d{2})\s+[A-Za-z]+\s*$/;
const PRICE_BARE_TRAILING_RE = /\s*(?:\d{1,3}(?:,\d{3})+|\d+)[.,]\d{2}\s*$/;

function isKeywordLine(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    SUBTOTAL_RE.test(lower) ||
    TOTAL_LABEL_RE.test(lower) ||
    TAX_RE.test(lower) ||
    SERVICE_CHARGE_RE.test(lower) ||
    ROUNDING_RE.test(lower) ||
    PAYMENT_METHOD_RE.test(lower)
  );
}

function pairNamesWithSuffixedPrices(lines: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    const nextPriceMatch = next ? next.match(PRICE_WITH_SUFFIX_RE) : null;
    if (next && nextPriceMatch && !PRICE_WITH_SUFFIX_RE.test(line) && !isKeywordLine(line)) {
      const strippedName = line.replace(PRICE_BARE_TRAILING_RE, '').trim();
      result.push(`${strippedName} ${nextPriceMatch[1]}`);
      i += 1;
    } else {
      result.push(line);
    }
  }
  return result;
}

const BARE_PRICE_LINE_RE = /^(?:\d{1,3}(?:,\d{3})+|\d+)[.,]\d{2}\s*$/;

function isPureNumberLine(line: string): boolean {
  return BARE_QTY_LINE_RE.test(line) || BARE_PRICE_LINE_RE.test(line);
}

function pairNamesWithNumberRuns(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!isKeywordLine(line) && /[A-Za-z]/.test(line)) {
      let runEnd = i + 1;
      while (runEnd < lines.length && runEnd - (i + 1) < 3 && isPureNumberLine(lines[runEnd])) {
        runEnd += 1;
      }
      while (runEnd > i + 1 && !BARE_PRICE_LINE_RE.test(lines[runEnd - 1])) {
        runEnd -= 1;
      }
      const runLength = runEnd - (i + 1);
      if (runLength >= 2 || (runLength === 1 && STARTS_WITH_QTY_RE.test(line))) {
        const priceLine = lines[runEnd - 1];
        const priceMatch = priceLine.match(BARE_PRICE_LINE_RE);
        if (priceMatch) {
          result.push(`${line} ${priceMatch[0].trim()}`);
          i = runEnd;
          continue;
        }
      }
    }
    result.push(line);
    i += 1;
  }
  return result;
}

function isStandaloneTotalsKeyword(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    (SUBTOTAL_RE.test(lower) ||
      TAX_RE.test(lower) ||
      ROUNDING_RE.test(lower) ||
      TOTAL_LABEL_RE.test(lower) ||
      SERVICE_CHARGE_RE.test(lower)) &&
    !PRICE_RE.test(line)
  );
}

function isStandalonePaymentMethod(line: string): boolean {
  return PAYMENT_METHOD_RE.test(line.toLowerCase()) && !PRICE_RE.test(line);
}

function zipDecoupledTotalsKeywords(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    let runEnd = i;
    while (runEnd < lines.length && isStandaloneTotalsKeyword(lines[runEnd])) {
      runEnd += 1;
    }
    const runLength = runEnd - i;
    if (runLength > 0) {
      let valuesStart = runEnd;
      while (valuesStart < lines.length && isStandalonePaymentMethod(lines[valuesStart])) {
        valuesStart += 1;
      }
      const values = lines.slice(valuesStart, valuesStart + runLength);
      const allBarePrices = values.length === runLength && values.every((v) => PRICE_ONLY_RE.test(v));
      if (allBarePrices) {
        for (let k = 0; k < runLength; k++) {
          result.push(`${lines[i + k]} ${values[k]}`);
        }
        for (let k = runEnd; k < valuesStart; k++) {
          result.push(lines[k]);
        }
        i = valuesStart + runLength;
        continue;
      }
      for (let k = i; k < runEnd; k++) {
        result.push(lines[k]);
      }
      i = runEnd;
      continue;
    }
    result.push(lines[i]);
    i += 1;
  }
  return result;
}

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
  const rawLines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /[A-Za-z0-9]/.test(line));

  const pricesPaired = pairNamesWithSuffixedPrices(rawLines);
  const numberRunsPaired = pairNamesWithNumberRuns(pricesPaired);
  const totalsZipped = zipDecoupledTotalsKeywords(numberRunsPaired);

  const lines: string[] = [];
  const consumed = new Set<number>();
  for (let i = 0; i < totalsZipped.length; i++) {
    if (consumed.has(i)) continue;
    const line = totalsZipped[i];
    const next = totalsZipped[i + 1];

    if (!PRICE_RE.test(line) && isMergeableLabel(line) && next && PRICE_ONLY_RE.test(next)) {
      lines.push(`${line} ${next}`);
      consumed.add(i + 1);
    } else if (PRICE_ONLY_RE.test(line) && next && !PRICE_RE.test(next) && isMergeableLabel(next)) {
      lines.push(`${next} ${line}`);
      consumed.add(i + 1);
    } else {
      lines.push(line);
    }
  }

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

    if (SUBTOTAL_RE.test(lower)) {
      result.subtotal = price;
      continue;
    }
    if (ROUNDING_RE.test(lower)) {
      // Rounding-adjustment lines (e.g. "Rnd Adj") aren't a purchasable item, tax, or the total.
      continue;
    }
    if (TAX_RE.test(lower)) {
      result.tax = price;
      continue;
    }
    if (SERVICE_CHARGE_RE.test(lower)) {
      result.serviceCharge = price;
      continue;
    }
    if (TOTAL_LABEL_RE.test(lower)) {
      result.total = price;
      continue;
    }
    if (PAYMENT_METHOD_RE.test(lower)) {
      continue;
    }

    const name = line
      .slice(0, priceMatch.index)
      .replace(UNIT_PRICE_RE, ' ')
      .replace(TRAILING_CURRENCY_RE, '')
      .replace(LEADING_QTY_RE, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (name) {
      result.items.push({ name, price });
    }
  }

  return result;
}
