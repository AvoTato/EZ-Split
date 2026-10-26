export type ReceiptItem = {
  name: string;
  price: number;
  qty: number;
};

export type ParsedReceipt = {
  items: ReceiptItem[];
  subtotal: number | null;
  // Stored as a positive amount. Receipts differ on whether the printed subtotal is
  // before or after the discount, so consumers should accept either.
  discount: number | null;
  serviceCharge: number | null;
  tax: number | null;
  total: number | null;
  needsReview: boolean;
};

export type OcrWord = {
  text: string;
  vertices: { x: number; y: number }[];
};

export type OcrResult = {
  text: string;
  rowsText: string | null;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type PlacedWord = { text: string; x: number; y: number; right: number };
type PlacedRow = { y: number; words: PlacedWord[] };

const PRICE_WORD_RE = /^-?\d+(?:,\d{3})*[.,]\d{2}$/;
const TABLE_ROW_RE = /^(.+?)\s+(\d{1,3})\s+(-?\d+[.,]\d{2})\s+(-?\d+[.,]\d{2})$/;
const WRAPPED_NAME_RE = /^[A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2}$/;
const WRAPPED_NAME_EXCLUDE_RE = /service|percent|charge|total|net|qty|discount|paid|card|remain|local|table|item|price|amt/i;

function clusterRows(words: PlacedWord[], height: number): PlacedRow[] {
  const rows: PlacedRow[] = [];
  for (const word of [...words].sort((a, b) => a.y - b.y)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(word.y - row.y) <= height * 0.5) {
      row.words.push(word);
      row.y = row.words.reduce((sum, w) => sum + w.y, 0) / row.words.length;
    } else {
      rows.push({ y: word.y, words: [word] });
    }
  }
  return rows;
}

function rowText(row: PlacedRow): string {
  return [...row.words]
    .sort((a, b) => a.x - b.x)
    .map((w) => w.text)
    .join(' ');
}

const NON_ITEM_ROW_PENALTY = 50;

function rowPenalty(row: PlacedRow): number {
  const text = rowText(row);
  if (!/[A-Za-z0-9]/.test(text.replace(CJK_RE, ''))) return NON_ITEM_ROW_PENALTY;
  if (text.startsWith('*')) return NON_ITEM_ROW_PENALTY;
  return 0;
}

function solveAssignment(
  labels: PlacedRow[],
  prices: PlacedWord[],
  height: number,
  penalties: number[],
  offsets: number[]
): (number | null)[] {
  const n = labels.length;
  const m = prices.length;
  const cost = (i: number, j: number) =>
    ((prices[j].y - offsets[j] - labels[i].y) / height) ** 2 + penalties[i];
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  for (let i = 0; i <= n; i++) dp[i][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= Math.min(i, m); j++) {
      dp[i][j] = Math.min(dp[i - 1][j], dp[i - 1][j - 1] + cost(i - 1, j - 1));
    }
  }

  const assignment: (number | null)[] = new Array(n).fill(null);
  let j = m;
  for (let i = n; i >= 1 && j >= 1; i--) {
    if (dp[i][j] === dp[i - 1][j]) continue;
    assignment[i - 1] = j - 1;
    j -= 1;
  }
  return assignment;
}

function matchPricesToLabels(labels: PlacedRow[], prices: PlacedWord[], height: number): (number | null)[] | null {
  const n = labels.length;
  const m = prices.length;
  if (m === 0 || n < m) return null;

  const penalties = labels.map(rowPenalty);
  const first = solveAssignment(labels, prices, height, penalties, new Array(m).fill(0));

  const drift: (number | null)[] = new Array(m).fill(null);
  first.forEach((priceIndex, i) => {
    if (priceIndex !== null && penalties[i] === 0) drift[priceIndex] = prices[priceIndex].y - labels[i].y;
  });
  const offsets = prices.map((_, j) => {
    const nearby: number[] = [];
    for (let k = Math.max(0, j - 3); k <= Math.min(m - 1, j + 3); k++) {
      const value = drift[k];
      if (value !== null) nearby.push(value);
    }
    return nearby.length > 0 ? median(nearby) : 0;
  });

  return solveAssignment(labels, prices, height, penalties, offsets);
}

export function buildRowsFromWords(words: OcrWord[]): string[] {
  const usable = words.filter((w) => w.text.trim() && w.vertices.length === 4);
  if (usable.length === 0) return [];

  const angle = median(
    usable.map((w) => Math.atan2(w.vertices[1].y - w.vertices[0].y, w.vertices[1].x - w.vertices[0].x))
  );
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const height = median(
    usable.map((w) => Math.hypot(w.vertices[3].x - w.vertices[0].x, w.vertices[3].y - w.vertices[0].y))
  );

  const placed: PlacedWord[] = usable.map((w) => {
    const cx = w.vertices.reduce((sum, v) => sum + v.x, 0) / 4;
    const cy = w.vertices.reduce((sum, v) => sum + v.y, 0) / 4;
    const width = Math.hypot(w.vertices[1].x - w.vertices[0].x, w.vertices[1].y - w.vertices[0].y);
    const x = cx * cos + cy * sin;
    return { text: w.text, x, y: -cx * sin + cy * cos, right: x + width / 2 };
  });

  const xs = placed.map((w) => w.x);
  const minX = Math.min(...xs);
  const priceZoneStart = minX + (Math.max(...xs) - minX) * 0.55;
  const zonePrices = placed
    .filter((w) => PRICE_WORD_RE.test(w.text) && w.x >= priceZoneStart)
    .sort((a, b) => b.right - a.right);
  const totalColumn: PlacedWord[] = [];
  for (const word of zonePrices) {
    const previous = totalColumn[totalColumn.length - 1];
    if (previous && previous.right - word.right > height * 3) break;
    totalColumn.push(word);
  }
  const prices = totalColumn.sort((a, b) => a.y - b.y);
  const priceSet = new Set(prices);
  const labelRows = clusterRows(placed.filter((w) => !priceSet.has(w)), height);

  const assignment = matchPricesToLabels(labelRows, prices, height);
  if (!assignment) {
    return clusterRows(placed, height).map(rowText);
  }

  let afterTableItem = false;
  return labelRows.map((row, i) => {
    const priceIndex = assignment[i];
    const label = rowText(row);
    if (priceIndex !== null) {
      const text = rowText({ y: row.y, words: [...row.words, prices[priceIndex]] });
      const table = text.match(TABLE_ROW_RE);
      afterTableItem = table !== null;
      return table ? `${table[2]} ${table[1]} @${table[3]} ${table[4]}` : text;
    }
    const wrapped = afterTableItem && WRAPPED_NAME_RE.test(label) && !WRAPPED_NAME_EXCLUDE_RE.test(label);
    afterTableItem = false;
    return wrapped ? `+ ${label}` : label;
  });
}

function extractWords(page: any): OcrWord[] {
  const words: OcrWord[] = [];
  for (const block of page?.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const word of paragraph.words ?? []) {
        const text = (word.symbols ?? []).map((symbol: { text?: string }) => symbol.text ?? '').join('');
        const vertices = (word.boundingBox?.vertices ?? []).map((v: { x?: number; y?: number }) => ({
          x: v.x ?? 0,
          y: v.y ?? 0,
        }));
        words.push({ text, vertices });
      }
    }
  }
  return words;
}

export async function callGoogleVisionOCR(base64Image: string): Promise<OcrResult> {
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
            imageContext: { languageHints: ['en', 'zh'] },
          },
        ],
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Google Vision request failed.');
  }

  const annotation = data?.responses?.[0]?.fullTextAnnotation;
  const text = annotation?.text;
  if (!text) {
    throw new Error('No text detected in the receipt image.');
  }
  const rows = buildRowsFromWords(extractWords(annotation.pages?.[0]));
  return { text, rowsText: rows.length > 0 ? rows.join('\n') : null };
}

const PRICE_RE = /(?<![à@#]\s{0,3})((?:\d{1,3}(?:,\d{3})+|\d+)[.,]\d{2})\s*[A-Za-z]{0,3}\s*$/;
const PRICE_ONLY_RE = /^[^\d]{0,6}(?:\d{1,3}(?:,\d{3})+|\d+)[.,]\d{2}\s*[A-Za-z]{0,3}\s*$/;
const LEADING_QTY_RE = /^\s*(?:(\d{1,2})\s*[xX]\s*|[xX]\s*(\d{1,2})\s+|(\d{1,2})\s+(?=\S))/;
const UNIT_PRICE_RE = /\s*[àA@#]\s*(\d+[.,]\d{2})\s*[A-Za-z]{0,4}\s*/g;
const CJK_RE = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]+/g;
const HAS_CJK_RE = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/;
const SUBTOTAL_RE = /sub\s*-?\s*total/;
const COUNT_BEFORE_SUBTOTAL_RE = /^\s*(\d{1,3})\s+sub\s*-?\s*total/i;
const TAX_SUMMARY_RE = /tax\s*summary/;
const TOTAL_QTY_RE = /total\s*(qty|quantity|items?|pax)/;
const STRONG_TOTAL_RE = /net\s*total|grand\s*total|amount due|total due|\bttl\b/;
const ADD_ON_RE = /^add[\s-]*on\b/i;
const VARIANT_LINE_RE = /^\s*\d{1,2}\s+[A-Za-z][A-Za-z\s'&-]*$/;
const TRAILING_CURRENCY_RE = /\s*(RM|MYR|SGD|USD|CHF|EUR|GBP|\$|€|£)\s*$/i;
const ROUNDING_RE = /(rnd|round)/;
const SERVICE_CHARGE_RE = /(svc|srv|service).*(chg|charge)|(chg|charge).*(svc|srv|service)/;
const TAX_RE = /\b(sst|vat|tax|gst|mwst)\b/;
const PAYMENT_METHOD_RE = /\b(visa|mastercard|master card|amex|cash|debit|credit card|card|duit\s*now|duitnow|paid|remain|remaining|change|tendered|nets|grabpay|touch\s*n\s*go|tng|paynow|alipay)\b/;
const NET_SUBTOTAL_RE = /^\s*(?:qty\s+(\d+)\s+)?net\b(?!\s*total)/i;
const DISCOUNT_RE = /discount/;
const ITEM_CODE_RE = /^[A-Za-z]{1,3}\d{1,4}$/;
const EMBEDDED_UNIT_RE = /\s(\d+[.,]\d{2})\s*$/;
const STARTS_WITH_QTY_RE = /^\s*(?:\d|[xX]\s*\d)/;
const TOTAL_LABEL_RE = /total|\bttl\b|amount due/;

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

function mergeBareQuantityLines(rawLines: string[]): string[] {
  const merged: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const next = rawLines[i + 1];
    if (BARE_QTY_LINE_RE.test(line) && next) {
      merged.push(`${line} ${next}`);
      i += 1;
    } else {
      merged.push(line);
    }
  }
  return merged;
}

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
    if (next && nextPriceMatch && PRICE_ONLY_RE.test(next) && !PRICE_WITH_SUFFIX_RE.test(line) && !isKeywordLine(line)) {
      const strippedName = line.replace(PRICE_BARE_TRAILING_RE, '').trim();
      result.push(`${strippedName} ${nextPriceMatch[1]}`);
      i += 1;
    } else {
      result.push(line);
    }
  }
  return result;
}

function isStandaloneTotalsKeyword(line: string): boolean {
  const lower = line.toLowerCase();
  if (SUBTOTAL_RE.test(lower)) return false;
  return (TAX_RE.test(lower) || ROUNDING_RE.test(lower) || TOTAL_LABEL_RE.test(lower)) && !PRICE_RE.test(line);
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
      const values = lines.slice(runEnd, runEnd + runLength);
      const allBarePrices = values.length === runLength && values.every((v) => PRICE_ONLY_RE.test(v));
      if (allBarePrices) {
        for (let k = 0; k < runLength; k++) {
          result.push(`${lines[i + k]} ${values[k]}`);
        }
        i = runEnd + runLength;
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

function tidyName(name: string): string {
  return name
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s*\+\s*/g, '+')
    .replace(/\s+([,.:;])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// The subtotal may be printed before or after the discount, so both readings are valid.
function expectedTotalsFor(receipt: ParsedReceipt): number[] {
  if (receipt.subtotal === null) return [];
  const base = receipt.subtotal + (receipt.tax ?? 0) + (receipt.serviceCharge ?? 0);
  return receipt.discount ? [base, base - receipt.discount] : [base];
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
function centsDivisible(price: number, qty: number): boolean {
  return Math.round(price * 100) % qty === 0;
}

function resolveQty(leadingQty: number | null, unitPrice: number | null, price: number): { qty: number; confirmed: boolean } {
  if (unitPrice && unitPrice > 0) {
    const derived = Math.round(price / unitPrice);
    if (derived >= 1 && Math.abs(derived * unitPrice - price) < 0.011) {
      return { qty: derived, confirmed: true };
    }
  }
  if (leadingQty === null) return { qty: 1, confirmed: false };
  if (leadingQty < 1 || !centsDivisible(price, leadingQty)) return { qty: 1, confirmed: false };
  return { qty: leadingQty, confirmed: leadingQty === 1 };
}

type Candidate = ReceiptItem & { confirmed: boolean };

function qtySums(items: Candidate[]): number[] {
  const all = items.reduce((sum, item) => sum + item.qty, 0);
  const withoutAddOns = items.reduce((sum, item) => sum + (ADD_ON_RE.test(item.name) ? 0 : item.qty), 0);
  return [all, withoutAddOns];
}

function reconcileQuantities(items: Candidate[], itemCount: number | null) {
  if (itemCount === null || qtySums(items).includes(itemCount)) return;
  const suspects = items.filter((item) => !item.confirmed && item.qty > 1);
  const fixes = suspects.filter((item) => {
    const original = item.qty;
    item.qty = 1;
    const matches = qtySums(items).includes(itemCount);
    item.qty = original;
    return matches;
  });
  if (fixes.length === 1) fixes[0].qty = 1;
}

/**
 * Best-effort heuristic parser for OCR'd receipt text. Receipt layouts vary a lot
 * (see the Berghotel vs. TGIF example receipts), so these rules are a prototype
 * starting point, not a robust parser — expect to tune them against real receipts.
 */
export function parseReceiptText(rawText: string): ParsedReceipt {
  const rawLines = rawText
    .split('\n')
    .filter((line) => !HAS_CJK_RE.test(line) || /[A-Za-z]/.test(line.replace(CJK_RE, ' ')))
    .map((line) => line.replace(CJK_RE, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter((line) => line && /[A-Za-z0-9]/.test(line));

  const qtyMerged = mergeBareQuantityLines(rawLines);
  const pricesPaired = pairNamesWithSuffixedPrices(qtyMerged);
  const totalsZipped = zipDecoupledTotalsKeywords(pricesPaired);

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
    discount: null,
    serviceCharge: null,
    tax: null,
    total: null,
    needsReview: false,
  };

  const candidates: Candidate[] = [];
  let itemCount: number | null = null;
  const totalCandidates: { value: number; rank: number }[] = [];
  let previousWasItem = false;
  let itemsClosed = false;
  let pendingCodeItem: Candidate | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (TAX_SUMMARY_RE.test(lower)) break;

    const priceMatch = line.match(PRICE_RE);
    if (!priceMatch) {
      if (
        pendingCodeItem &&
        !/^\d/.test(line) &&
        /[A-Za-z]{3}/.test(line) &&
        !isKeywordLine(line)
      ) {
        pendingCodeItem.name = tidyName(line);
        pendingCodeItem = null;
        previousWasItem = false;
        continue;
      }
      if (previousWasItem && candidates.length > 0 && line.startsWith('+ ')) {
        const last = candidates[candidates.length - 1];
        last.name = `${last.name} ${line.slice(2).trim()}`;
        continue;
      }
      if (previousWasItem && candidates.length > 0 && VARIANT_LINE_RE.test(line) && !isKeywordLine(line)) {
        const variant = line.replace(LEADING_QTY_RE, '').trim();
        const last = candidates[candidates.length - 1];
        if (variant && !last.name.includes(`(${variant})`)) {
          last.name = `${last.name} (${variant})`;
        }
      } else {
        previousWasItem = false;
      }
      continue;
    }
    const price = toNumber(priceMatch[1]);
    pendingCodeItem = null;

    const netMatch = line.match(NET_SUBTOTAL_RE);
    if (netMatch) {
      itemsClosed = true;
      result.subtotal = price;
      if (netMatch[1]) itemCount = parseInt(netMatch[1], 10);
      previousWasItem = false;
      continue;
    }
    if (DISCOUNT_RE.test(lower)) {
      if (price !== 0) result.discount = (result.discount ?? 0) + price;
      previousWasItem = false;
      continue;
    }
    if (SUBTOTAL_RE.test(lower)) {
      itemsClosed = true;
      result.subtotal = price;
      const countMatch = line.match(COUNT_BEFORE_SUBTOTAL_RE);
      if (countMatch) itemCount = parseInt(countMatch[1], 10);
      previousWasItem = false;
      continue;
    }
    if (ROUNDING_RE.test(lower) && !STRONG_TOTAL_RE.test(lower)) {
      previousWasItem = false;
      continue;
    }
    if (TAX_RE.test(lower)) {
      if (result.tax === null) result.tax = price;
      previousWasItem = false;
      continue;
    }
    if (SERVICE_CHARGE_RE.test(lower)) {
      result.serviceCharge = price;
      previousWasItem = false;
      continue;
    }
    if (TOTAL_LABEL_RE.test(lower)) {
      const rank = STRONG_TOTAL_RE.test(lower) ? 2 : TOTAL_QTY_RE.test(lower) ? 0 : 1;
      if (rank > 0) {
        totalCandidates.push({ value: price, rank });
        itemsClosed = true;
      }
      previousWasItem = false;
      continue;
    }
    if (PAYMENT_METHOD_RE.test(lower)) {
      previousWasItem = false;
      continue;
    }

    let unitPrice: number | null = null;
    const withoutPrice = line
      .slice(0, priceMatch.index)
      .replace(UNIT_PRICE_RE, (_match, unit: string) => {
        unitPrice = toNumber(unit);
        return ' ';
      })
      .replace(TRAILING_CURRENCY_RE, '');

    const qtyMatch = withoutPrice.match(LEADING_QTY_RE);
    const leadingQty = qtyMatch ? parseInt(qtyMatch[1] ?? qtyMatch[2] ?? qtyMatch[3], 10) : null;

    const name = tidyName(
      withoutPrice
        .replace(LEADING_QTY_RE, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[\s:;,.\-]+|[\s:;,.\-]+$/g, '')
    );

    if (price === 0) {
      previousWasItem = false;
      continue;
    }

    if (unitPrice === null && leadingQty !== null) {
      const embedded = withoutPrice.replace(LEADING_QTY_RE, '').match(EMBEDDED_UNIT_RE);
      if (embedded) {
        const candidate = toNumber(embedded[1]);
        if (candidate > 0 && Math.round(price / candidate) === leadingQty && Math.abs(leadingQty * candidate - price) < 0.011) {
          unitPrice = candidate;
        }
      }
    }

    if (name && !itemsClosed) {
      const { qty, confirmed } = resolveQty(leadingQty, unitPrice, price);
      const candidate: Candidate = { name, price, qty, confirmed };
      candidates.push(candidate);
      previousWasItem = true;
      if (ITEM_CODE_RE.test(name)) pendingCodeItem = candidate;
    }
  }

  const expectedTotals = expectedTotalsFor(result);
  const reconciledTotal = [...totalCandidates]
    .reverse()
    .find((c) => expectedTotals.some((expected) => Math.abs(c.value - expected) <= 0.1));
  if (reconciledTotal) {
    result.total = reconciledTotal.value;
  } else if (totalCandidates.length > 0) {
    const topRank = Math.max(...totalCandidates.map((c) => c.rank));
    result.total = [...totalCandidates].reverse().find((c) => c.rank === topRank)!.value;
  }

  reconcileQuantities(candidates, itemCount);
  result.items = candidates.map(({ name, price, qty }) => ({ name, price, qty }));

  const itemsSum = result.items.reduce((sum, item) => sum + item.price, 0);
  const discount = result.discount ?? 0;
  if (
    result.subtotal !== null &&
    Math.abs(itemsSum - result.subtotal) > 0.01 &&
    Math.abs(itemsSum - discount - result.subtotal) > 0.01
  ) {
    result.needsReview = true;
  }
  if (result.total !== null && expectedTotals.length > 0) {
    const total = result.total;
    if (expectedTotals.every((expected) => Math.abs(total - expected) > 0.1)) result.needsReview = true;
  }

  return result;
}
