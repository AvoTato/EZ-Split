import type { ParsedReceipt, ReceiptItem } from './parseReceipt';

export type ReceiptField = 'subtotal' | 'discount' | 'tax' | 'serviceCharge' | 'total';

// A single edit to a receipt. The review screen, one-tap fixes, and typed commands all
// produce these, so every correction goes through the same applyPatch path.
export type ReceiptPatch =
  | { type: 'setItem'; index: number; fields: Partial<ReceiptItem> }
  | { type: 'addItem'; item: ReceiptItem }
  | { type: 'removeItem'; index: number }
  | { type: 'setField'; field: ReceiptField; value: number | null };

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function itemsSum(receipt: ParsedReceipt) {
  return round2(receipt.items.reduce((sum, item) => sum + item.price, 0));
}

// `price` on a receipt item is the line total, so the per-unit price is derived.
export function unitPrice(item: ReceiptItem) {
  return item.qty > 0 ? item.price / item.qty : item.price;
}

export function applyPatch(receipt: ParsedReceipt, patch: ReceiptPatch): ParsedReceipt {
  switch (patch.type) {
    case 'setItem':
      if (!receipt.items[patch.index]) return receipt;
      return {
        ...receipt,
        items: receipt.items.map((item, i) => (i === patch.index ? { ...item, ...patch.fields } : item)),
      };
    case 'addItem':
      return { ...receipt, items: [...receipt.items, patch.item] };
    case 'removeItem':
      if (!receipt.items[patch.index]) return receipt;
      return { ...receipt, items: receipt.items.filter((_, i) => i !== patch.index) };
    case 'setField':
      return { ...receipt, [patch.field]: patch.value };
  }
}

export function applyPatches(receipt: ParsedReceipt, patches: ReceiptPatch[]) {
  return patches.reduce(applyPatch, receipt);
}

// Parses user-typed money ("12", "RM 12.50", "12,50"). Returns null for blank/invalid input.
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/rm/i, '').replace(',', '.').trim();
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  return round2(Number(cleaned));
}

// Same tolerances as the parser: items must match the subtotal to the sen, while the
// total gets 10 sen of slack for 5-sen cash rounding.
const ITEMS_TOLERANCE = 0.01;
const TOTAL_TOLERANCE = 0.1;
const TAX_RATES = [6, 8, 10];
const SERVICE_RATES = [5, 6, 10];
const RATE_TOLERANCE = 1;

function near(a: number, b: number, tolerance: number) {
  return Math.abs(a - b) <= tolerance + 1e-9;
}

function isWholeSen(value: number) {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

// The subtotal after any discount. Receipts print the subtotal either before or after
// the discount; if it already equals items minus discount, it's taken as-is.
export function netSubtotal(receipt: ParsedReceipt) {
  const sum = itemsSum(receipt);
  const discount = receipt.discount ?? 0;
  if (receipt.subtotal === null) return round2(sum - discount);
  if (discount && near(sum - discount, receipt.subtotal, ITEMS_TOLERANCE)) return receipt.subtotal;
  return round2(receipt.subtotal - discount);
}

export function expectedTotal(receipt: ParsedReceipt) {
  return round2(netSubtotal(receipt) + (receipt.tax ?? 0) + (receipt.serviceCharge ?? 0));
}

export type ReceiptIssue = {
  id: string;
  severity: 'warning' | 'info';
  message: string;
  target: { kind: 'item'; index: number } | { kind: 'field'; field: ReceiptField };
  fix?: { label: string; patch: ReceiptPatch };
};

function money(value: number) {
  return `RM${value.toFixed(2)}`;
}

function itemLabel(receipt: ParsedReceipt, index: number) {
  const name = receipt.items[index].name.trim();
  return name ? `Item ${index + 1} "${name}"` : `Item ${index + 1}`;
}

function checkItems(receipt: ParsedReceipt): ReceiptIssue[] {
  const issues: ReceiptIssue[] = [];
  receipt.items.forEach((item, index) => {
    const target = { kind: 'item', index } as const;
    if (!item.name.trim()) {
      issues.push({ id: `name-${index}`, severity: 'warning', target, message: `Item ${index + 1} has no name.` });
    }
    if (item.price <= 0) {
      issues.push({
        id: `price-${index}`,
        severity: 'warning',
        target,
        message: `${itemLabel(receipt, index)} has no price.`,
      });
    } else if (item.qty > 1 && !isWholeSen(item.price / item.qty)) {
      issues.push({
        id: `qty-${index}`,
        severity: 'warning',
        target,
        message: `${money(item.price)} ÷ ${item.qty} isn't an exact price — the quantity may be misread.`,
        fix: { label: 'Set qty to 1', patch: { type: 'setItem', index, fields: { qty: 1 } } },
      });
    }
  });
  return issues;
}

// The later of two same-name, same-price lines whose price equals the gap — the usual
// shape of an OCR line read twice.
function findDuplicate(receipt: ParsedReceipt, gap: number) {
  const key = (index: number) => receipt.items[index].name.trim().toLowerCase();
  for (let i = receipt.items.length - 1; i > 0; i--) {
    if (!near(receipt.items[i].price, gap, ITEMS_TOLERANCE)) continue;
    for (let j = 0; j < i; j++) {
      if (key(j) === key(i) && near(receipt.items[j].price, receipt.items[i].price, ITEMS_TOLERANCE)) {
        return i;
      }
    }
  }
  return -1;
}

function checkSubtotal(receipt: ParsedReceipt): ReceiptIssue | null {
  if (receipt.subtotal === null) return null;
  const sum = itemsSum(receipt);
  const discount = receipt.discount ?? 0;
  const gapBefore = round2(sum - receipt.subtotal);
  const gapAfter = round2(sum - discount - receipt.subtotal);
  if (near(gapBefore, 0, ITEMS_TOLERANCE) || (discount && near(gapAfter, 0, ITEMS_TOLERANCE))) {
    return null;
  }
  const gap = discount && Math.abs(gapAfter) < Math.abs(gapBefore) ? gapAfter : gapBefore;

  if (gap < 0) {
    const missing = -gap;
    return {
      id: 'subtotal-short',
      severity: 'warning',
      target: { kind: 'field', field: 'subtotal' },
      message: `Items add up to ${money(missing)} less than the subtotal — an item may be missing.`,
      fix: {
        label: `Add missing item (${money(missing)})`,
        patch: { type: 'addItem', item: { name: 'Missing item', price: missing, qty: 1 } },
      },
    };
  }

  const duplicate = findDuplicate(receipt, gap);
  if (duplicate >= 0) {
    return {
      id: 'subtotal-duplicate',
      severity: 'warning',
      target: { kind: 'item', index: duplicate },
      message: `Items add up to ${money(gap)} more than the subtotal. ${itemLabel(receipt, duplicate)} looks like a duplicate.`,
      fix: { label: `Remove item ${duplicate + 1}`, patch: { type: 'removeItem', index: duplicate } },
    };
  }

  const matches = receipt.items.flatMap((item, index) =>
    near(item.price, gap, ITEMS_TOLERANCE) ? [index] : []
  );
  if (matches.length === 1) {
    const index = matches[0];
    return {
      id: 'subtotal-extra',
      severity: 'warning',
      target: { kind: 'item', index },
      message: `Items add up to ${money(gap)} more than the subtotal. ${itemLabel(receipt, index)} may not belong on this receipt.`,
      fix: { label: `Remove item ${index + 1}`, patch: { type: 'removeItem', index } },
    };
  }

  return {
    id: 'subtotal-over',
    severity: 'warning',
    target: { kind: 'field', field: 'subtotal' },
    message: `Items add up to ${money(sum)}, but the subtotal says ${money(receipt.subtotal)}.`,
    fix: {
      label: `Set subtotal to ${money(sum)}`,
      patch: { type: 'setField', field: 'subtotal', value: sum },
    },
  };
}

function checkTotal(receipt: ParsedReceipt): ReceiptIssue | null {
  const expected = expectedTotal(receipt);
  const target = { kind: 'field', field: 'total' } as const;
  if (receipt.total === null) {
    if (expected <= 0) return null;
    return {
      id: 'total-missing',
      severity: 'warning',
      target,
      message: 'No total was found on the receipt.',
      fix: { label: `Use ${money(expected)}`, patch: { type: 'setField', field: 'total', value: expected } },
    };
  }
  if (near(receipt.total, expected, TOTAL_TOLERANCE)) return null;
  return {
    id: 'total-mismatch',
    severity: 'warning',
    target,
    message: `The amounts above add up to ${money(expected)}, but the total says ${money(receipt.total)}.`,
    fix: {
      label: `Set total to ${money(expected)}`,
      patch: { type: 'setField', field: 'total', value: expected },
    },
  };
}

function checkRate(
  receipt: ParsedReceipt,
  field: 'tax' | 'serviceCharge',
  label: string,
  usualRates: number[]
): ReceiptIssue | null {
  const amount = receipt[field];
  const base = netSubtotal(receipt);
  if (amount === null || amount <= 0 || base <= 0) return null;
  const pct = (amount / base) * 100;
  if (usualRates.some((rate) => near(pct, rate, RATE_TOLERANCE))) return null;
  const usual = usualRates.map((rate) => `${rate}%`).join(', ');
  return {
    id: `${field}-rate`,
    severity: 'info',
    target: { kind: 'field', field },
    message: `${label} is ${pct.toFixed(1)}% of the subtotal — usually ${usual}. Worth a double-check.`,
  };
}

export function checkReceipt(receipt: ParsedReceipt): ReceiptIssue[] {
  return [
    ...checkItems(receipt),
    checkSubtotal(receipt),
    checkTotal(receipt),
    checkRate(receipt, 'tax', 'SST', TAX_RATES),
    checkRate(receipt, 'serviceCharge', 'Service charge', SERVICE_RATES),
  ].filter((issue): issue is ReceiptIssue => issue !== null);
}
