import type { ParsedReceipt } from './parseReceipt';
import type { ReceiptField, ReceiptPatch } from './receiptReview';

export type CommandResult =
  | { ok: true; patches: ReceiptPatch[]; summary: string }
  | { ok: false; error: string };

// Turns a typed correction into patches. The rule-based version below is the default;
// an LLM-backed interpreter can implement the same signature without UI changes.
// Patches are applied in order, so index-based patches must account for earlier removals.
export type CorrectionInterpreter = (text: string, receipt: ParsedReceipt) => Promise<CommandResult>;

export const COMMAND_EXAMPLES = [
  'change item 3 to RM12',
  'teh tarik to 4.50',
  'item 2 qty 2',
  'rename item 1 to nasi lemak',
  'delete item 4',
  'add milo ais 4.50',
  'total 45.60',
];

const AMOUNT = String.raw`(?:rm\s*)?(\d+(?:[.,]\d{1,2})?)`;
// "item 3 to 12", "item 3 = 12", "item 3: 12", "item 3 12"
const TARGET_VALUE_RE = new RegExp(String.raw`^(.+?)(?:\s+(?:to|is)\s+|\s*[=:]\s*|\s+)${AMOUNT}(\s+each)?$`, 'i');
const ADD_RE = new RegExp(
  String.raw`^add\s+(?:(\d+)\s*[x×]\s+|[x×]\s*(\d+)\s+|(\d+)\s+)?(.+?)\s+(?:(?:for|at)\s+)?${AMOUNT}(\s+each)?$`,
  'i'
);
const LEADING_VERB_RE = /^(?:please\s+)?(?:change|set|make|update|fix|correct)\s+/i;

const FIELDS: { re: RegExp; field: ReceiptField; label: string }[] = [
  { re: /^sub\s*-?\s*total$/i, field: 'subtotal', label: 'Subtotal' },
  { re: /^(?:grand\s+|net\s+)?total$/i, field: 'total', label: 'Total' },
  { re: /^(?:sst|tax|gst)$/i, field: 'tax', label: 'SST' },
  { re: /^(?:service(?:\s+charge)?|svc)$/i, field: 'serviceCharge', label: 'Service charge' },
  { re: /^discount$/i, field: 'discount', label: 'Discount' },
];

function toAmount(raw: string) {
  return Math.round(parseFloat(raw.replace(',', '.')) * 100) / 100;
}

function money(value: number) {
  return `RM${value.toFixed(2)}`;
}

function findField(text: string) {
  return FIELDS.find(({ re }) => re.test(text.trim()));
}

function itemLabel(receipt: ParsedReceipt, index: number) {
  const name = receipt.items[index].name.trim();
  return `Item ${index + 1} · ${name || 'unnamed'}`;
}

type ItemRef = { ok: true; index: number } | { ok: false; error: string };

// Accepts "item 3", "#3", "3", or (part of) an item's name.
function resolveItem(ref: string, receipt: ParsedReceipt): ItemRef {
  const trimmed = ref.trim();
  const numbered = trimmed.match(/^(?:item\s*)?#?(\d+)$/i);
  if (numbered) {
    const index = Number(numbered[1]) - 1;
    if (!receipt.items[index]) {
      const count = receipt.items.length;
      return { ok: false, error: `There's no item ${numbered[1]} — the receipt has ${count} item${count === 1 ? '' : 's'}.` };
    }
    return { ok: true, index };
  }

  const needle = trimmed.toLowerCase();
  const names = receipt.items.map((item) => item.name.trim().toLowerCase());
  const exact = names.flatMap((name, i) => (name === needle ? [i] : []));
  if (exact.length === 1) return { ok: true, index: exact[0] };
  const partial = names.flatMap((name, i) => (name.includes(needle) ? [i] : []));
  if (partial.length === 1) return { ok: true, index: partial[0] };
  if (partial.length === 0) return { ok: false, error: `No item matches "${trimmed}".` };
  const list = partial.map((i) => `item ${i + 1}`).join(', ');
  return {
    ok: false,
    error: `"${trimmed}" matches more than one item (${list}). Use the item number instead, e.g. "item ${partial[0] + 1}".`,
  };
}

function setFieldResult(receipt: ParsedReceipt, field: ReceiptField, label: string, value: number | null): CommandResult {
  const before = receipt[field];
  return {
    ok: true,
    patches: [{ type: 'setField', field, value }],
    summary: `${label}: ${before === null ? '—' : money(before)} → ${value === null ? 'none' : money(value)}`,
  };
}

function interpretRemove(target: string, receipt: ParsedReceipt): CommandResult {
  const field = findField(target);
  if (field) return setFieldResult(receipt, field.field, field.label, null);
  const ref = resolveItem(target, receipt);
  if (!ref.ok) return ref;
  const item = receipt.items[ref.index];
  return {
    ok: true,
    patches: [{ type: 'removeItem', index: ref.index }],
    summary: `Remove ${itemLabel(receipt, ref.index)} (${money(item.price)})`,
  };
}

function interpretRename(target: string, newName: string, receipt: ParsedReceipt): CommandResult {
  const ref = resolveItem(target, receipt);
  if (!ref.ok) return ref;
  const name = newName.trim().replace(/^["']|["']$/g, '');
  if (!name) return { ok: false, error: 'What should the new name be?' };
  return {
    ok: true,
    patches: [{ type: 'setItem', index: ref.index, fields: { name } }],
    summary: `Item ${ref.index + 1}: "${receipt.items[ref.index].name}" → "${name}"`,
  };
}

function interpretAdd(match: RegExpMatchArray): CommandResult {
  const qty = Number(match[1] ?? match[2] ?? match[3] ?? 1);
  const name = match[4].trim();
  const amount = toAmount(match[5]);
  const price = match[6] ? Math.round(amount * qty * 100) / 100 : amount;
  if (qty < 1) return { ok: false, error: 'Quantity must be at least 1.' };
  return {
    ok: true,
    patches: [{ type: 'addItem', item: { name, price, qty } }],
    summary: `Add ${qty > 1 ? `${qty}× ` : ''}${name} · ${money(price)}`,
  };
}

function interpretTargetValue(target: string, rawAmount: string, each: boolean, receipt: ParsedReceipt): CommandResult {
  const amount = toAmount(rawAmount);

  const field = findField(target);
  if (field) return setFieldResult(receipt, field.field, field.label, amount);

  const qtyTarget = target.match(/^(.+?)\s+(?:qty|quantity)$/i);
  if (qtyTarget) {
    if (!Number.isInteger(amount) || amount < 1) {
      return { ok: false, error: 'Quantity must be a whole number, e.g. "item 2 qty 2".' };
    }
    const ref = resolveItem(qtyTarget[1], receipt);
    if (!ref.ok) return ref;
    const item = receipt.items[ref.index];
    return {
      ok: true,
      patches: [{ type: 'setItem', index: ref.index, fields: { qty: amount } }],
      summary: `${itemLabel(receipt, ref.index)}: qty ${item.qty} → ${amount} (line total stays ${money(item.price)})`,
    };
  }

  const ref = resolveItem(target.replace(/\s+(?:price|cost)$/i, ''), receipt);
  if (!ref.ok) return ref;
  const item = receipt.items[ref.index];
  const price = each ? Math.round(amount * item.qty * 100) / 100 : amount;
  return {
    ok: true,
    patches: [{ type: 'setItem', index: ref.index, fields: { price } }],
    summary: `${itemLabel(receipt, ref.index)}: ${money(item.price)} → ${money(price)}`,
  };
}

export function interpretCommand(text: string, receipt: ParsedReceipt): CommandResult {
  const command = text.trim().replace(/\s+/g, ' ').replace(/[!?]+$/, '').replace(/\.$/, '');
  if (!command) return { ok: false, error: 'Type what to fix, e.g. "change item 3 to RM12".' };

  const remove = command.match(/^(?:delete|remove|clear|no)\s+(.+)$/i);
  if (remove) return interpretRemove(remove[1], receipt);

  const rename =
    command.match(/^rename\s+(.+?)\s+(?:to|as)\s+(.+)$/i) ??
    command.replace(LEADING_VERB_RE, '').match(/^(.+?)\s+name\s+(?:to\s+|is\s+)?(.+)$/i);
  if (rename) return interpretRename(rename[1], rename[2], receipt);

  if (/^add\s/i.test(command)) {
    const add = command.match(ADD_RE);
    if (add) return interpretAdd(add);
    return { ok: false, error: 'Adding needs a name and a price, e.g. "add milo ais 4.50".' };
  }

  const targetValue = command.replace(LEADING_VERB_RE, '').match(TARGET_VALUE_RE);
  if (targetValue) return interpretTargetValue(targetValue[1], targetValue[2], !!targetValue[3], receipt);

  return { ok: false, error: "Sorry, I didn't understand that." };
}

export const ruleBasedInterpreter: CorrectionInterpreter = async (text, receipt) =>
  interpretCommand(text, receipt);
