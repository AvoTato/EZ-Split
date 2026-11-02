import type { ParsedReceipt } from './parseReceipt';
import type { SettlementPerson, UnassignedItem } from './receiptSession';

// Everything the explanation may mention, already worked out and formatted. The AI only
// rewords this; it never sees raw numbers to compute with.
export type SplitFacts = {
  discount: string | null;
  serviceCharge: string | null;
  serviceRate: string | null;
  tax: string | null;
  taxRate: string | null;
  sharedItems: { name: string; sharedBy: string[] }[];
  people: {
    name: string;
    share: string;
    items: string;
    discount: string | null;
    serviceCharge: string | null;
    tax: string | null;
    rounding: string | null;
    total: string;
  }[];
  unassigned: string | null;
};

type Money = (value: number) => string;

const pct = (part: number | null, whole: number | null) =>
  part === null || whole === null || whole === 0 ? null : `${Math.round((part / whole) * 100)}%`;

const amountOrNull = (value: number | null | undefined, money: Money) =>
  value ? money(value) : null;

export function splitFacts(
  receipt: ParsedReceipt,
  people: SettlementPerson[],
  unassignedItems: UnassignedItem[] | undefined,
  money: Money
): SplitFacts {
  const sharers = new Map<string, string[]>();
  for (const person of people) {
    for (const item of person.breakdown?.items ?? []) {
      if (item.cost < 0) continue;
      sharers.set(item.name, [...(sharers.get(item.name) ?? []), person.name]);
    }
  }
  const unassignedTotal = (unassignedItems ?? []).reduce((s, i) => s + (i.withCharges ?? i.price), 0);

  return {
    discount: amountOrNull(receipt.discount, money),
    serviceCharge: amountOrNull(receipt.serviceCharge, money),
    serviceRate: receipt.serviceCharge ? pct(receipt.serviceCharge, receipt.subtotal) : null,
    tax: amountOrNull(receipt.tax, money),
    taxRate: receipt.tax ? pct(receipt.tax, receipt.subtotal) : null,
    sharedItems: [...sharers]
      .filter(([, names]) => names.length > 1)
      .map(([name, sharedBy]) => ({ name, sharedBy })),
    people: people
      .filter((person) => person.breakdown)
      .map((person) => {
        const b = person.breakdown!;
        return {
          name: person.name,
          share: `${Math.round(b.proportion * 100)}%`,
          items: money(b.itemsSubtotal),
          discount: amountOrNull(b.discount, money),
          serviceCharge: amountOrNull(b.serviceCharge, money),
          tax: amountOrNull(b.tax, money),
          rounding: amountOrNull(b.rounding, money),
          total: money(person.amount),
        };
      }),
    unassigned: unassignedTotal ? money(unassignedTotal) : null,
  };
}

const list = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

const labelled = (label: string, amount: string | null, rate: string | null) =>
  amount ? `${label}${rate ? ` ${rate}` : ''} (${amount})` : null;

// Plain-text explanation used offline, when the AI is unavailable, or its answer is rejected.
export function describeSplit(facts: SplitFacts) {
  const lines: string[] = [];

  if (facts.sharedItems.length > 0) {
    const shared = facts.sharedItems.map((item) => `${item.name} between ${list(item.sharedBy)}`);
    lines.push(`Shared items were divided by portion: ${shared.join('; ')}.`);
  }

  const fees = [
    labelled('the discount', facts.discount, null),
    labelled('service charge', facts.serviceCharge, facts.serviceRate),
    labelled('tax', facts.tax, facts.taxRate),
  ].filter((fee): fee is string => fee !== null);
  if (fees.length > 0) {
    const subject = list(fees);
    lines.push(
      `${subject[0].toUpperCase()}${subject.slice(1)} ${fees.length > 1 ? 'were' : 'was'} split by each person's share of the items, so whoever ordered more pays more.`
    );
  }

  for (const person of facts.people) {
    const parts = [
      person.discount && `-${person.discount} discount`,
      person.serviceCharge && `+${person.serviceCharge} service`,
      person.tax && `+${person.tax} tax`,
      person.rounding && `${person.rounding.startsWith('-') ? '' : '+'}${person.rounding} rounding`,
    ].filter(Boolean);
    lines.push(
      `${person.name} had ${person.share} of the items (${person.items})${parts.length ? `: ${parts.join(', ')}` : ''}, so pays ${person.total}.`
    );
  }

  if (facts.unassigned) lines.push(`${facts.unassigned} of unassigned items is not included above.`);
  return lines.join('\n');
}
