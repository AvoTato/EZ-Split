import type { ParsedReceipt, ReceiptItem } from './parseReceipt';
import type {
  ItemAssignment,
  Person,
  PersonBreakdown,
  SettlementPerson,
  UnassignedItem,
} from './receiptSession';

// Gaps between the receipt total and the computed bill up to this many cents are the
// receipt's own rounding (e.g. to the nearest 5 sen) and get shared out. Bigger gaps are
// misreads, which receiptReview flags instead.
const MAX_ROUNDING_CENTS = 10;

// `price` is the line total. Shares are units eaten, so each share is worth one unit —
// unless more shares were handed out than there are units (e.g. two people sharing one
// dish), in which case the line is split across all shares instead.
export function itemShareCost(item: ReceiptItem, shares: number, totalShares: number) {
  const divisor = Math.max(totalShares, item.qty, 1);
  return (item.price * shares) / divisor;
}

export function totalSharesByItem(receipt: ParsedReceipt, assignments: ItemAssignment[]) {
  return receipt.items.map((_, itemIndex) =>
    assignments.filter((a) => a.itemIndex === itemIndex).reduce((sum, a) => sum + a.shares, 0)
  );
}

const toCents = (value: number) => Math.round(value * 100);

// Splits `total` integer cents in proportion to integer `weights`, so the parts always add
// back up to `total` exactly. Leftover cents go to the largest remainders, ties to the
// earliest entry.
export function allocateCents(total: number, weights: number[]) {
  let sum = weights.reduce((s, w) => s + w, 0);
  if (sum === 0 || total === 0) return weights.map(() => 0);
  const sign = sum < 0 ? -1 : 1;
  sum *= sign;
  const parts = weights.map((w, index) => {
    const numerator = total * w * sign;
    const floor = Math.floor(numerator / sum);
    return { index, floor, remainder: numerator - floor * sum };
  });
  let left = total - parts.reduce((s, p) => s + p.floor, 0);
  const result = parts.map((p) => p.floor);
  [...parts]
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .forEach((p) => {
      if (left > 0) {
        result[p.index] += 1;
        left -= 1;
      }
    });
  return result;
}

type Bucket = { personIndex: number } | { unassigned: number };

type ItemSplit = {
  // Cents per payer (people first, then one slot per unassigned leftover).
  cents: Map<number, number>;
  shares: Map<number, { shares: number; outOf: number }>;
};

// A negative line nobody ticked (e.g. "-0.38" printed under a dish) is that dish's
// discount, so it follows the dish: whoever had the dish shares the discount the same way.
function parentDishIndex(receipt: ParsedReceipt, itemIndex: number) {
  for (let i = itemIndex - 1; i >= 0; i--) {
    if (receipt.items[i].price > 0) return i;
    if (receipt.items[i].price === 0) return -1;
  }
  return -1;
}

export function computeSettlement(receipt: ParsedReceipt, people: Person[], assignments: ItemAssignment[]) {
  const totalShares = totalSharesByItem(receipt, assignments);
  const buckets: Bucket[] = people.map((_, personIndex) => ({ personIndex }));
  const unassignedItems: UnassignedItem[] = [];
  const personSlot = new Map(people.map((p, index) => [p.id, index]));

  const addUnassigned = (name: string) => {
    unassignedItems.push({ name, price: 0 });
    buckets.push({ unassigned: unassignedItems.length - 1 });
    return buckets.length - 1;
  };

  const splits: ItemSplit[] = [];
  receipt.items.forEach((item, itemIndex) => {
    const priceCents = toCents(item.price);
    const assigned = totalShares[itemIndex];
    const parent = item.price < 0 && assigned === 0 ? parentDishIndex(receipt, itemIndex) : -1;

    if (parent >= 0) {
      const dish = splits[parent];
      const slots = [...dish.cents.keys()];
      const weights = slots.map((slot) => dish.cents.get(slot) ?? 0);
      const parts = allocateCents(priceCents, weights);
      const split: ItemSplit = { cents: new Map(), shares: new Map() };
      slots.forEach((slot, i) => {
        if (parts[i] === 0) return;
        const target = 'unassigned' in buckets[slot] ? addUnassigned(item.name) : slot;
        split.cents.set(target, parts[i]);
        const dishShares = dish.shares.get(slot);
        if (dishShares) split.shares.set(target, dishShares);
      });
      splits.push(split);
      return;
    }

    const divisor = Math.max(assigned, item.qty, 1);
    const slots: number[] = [];
    const weights: number[] = [];
    const split: ItemSplit = { cents: new Map(), shares: new Map() };
    assignments
      .filter((a) => a.itemIndex === itemIndex && a.shares > 0)
      .forEach((a) => {
        const slot = personSlot.get(a.personId);
        if (slot === undefined) return;
        slots.push(slot);
        weights.push(a.shares);
        split.shares.set(slot, { shares: a.shares, outOf: divisor });
      });
    if (assigned === 0) {
      slots.push(addUnassigned(item.name));
      weights.push(divisor);
    } else if (assigned < item.qty) {
      const leftover = item.qty - assigned;
      slots.push(addUnassigned(`${leftover} of ${item.qty}× ${item.name}`));
      weights.push(leftover);
    }
    const parts = allocateCents(priceCents, weights);
    slots.forEach((slot, i) => split.cents.set(slot, parts[i]));
    splits.push(split);
  });

  const subtotals = buckets.map((_, slot) =>
    splits.reduce((sum, split) => sum + (split.cents.get(slot) ?? 0), 0)
  );
  const itemsCents = subtotals.reduce((s, c) => s + c, 0);

  const discountCents = Math.abs(toCents(receipt.discount ?? 0));
  const taxCents = toCents(receipt.tax ?? 0);
  const serviceCents = toCents(receipt.serviceCharge ?? 0);
  const billCents = itemsCents - discountCents + taxCents + serviceCents;
  const gap = receipt.total === null ? 0 : toCents(receipt.total) - billCents;
  const roundingCents = Math.abs(gap) <= MAX_ROUNDING_CENTS ? gap : 0;

  // Discount, tax, service and rounding are shared by each payer's share of the items,
  // counting unassigned leftovers, so nobody absorbs fees for food they didn't have.
  const discounts = allocateCents(discountCents, subtotals);
  const taxes = allocateCents(taxCents, subtotals);
  const services = allocateCents(serviceCents, subtotals);
  const roundings = allocateCents(roundingCents, subtotals);
  const amountCents = (slot: number) =>
    subtotals[slot] - discounts[slot] + taxes[slot] + services[slot] + roundings[slot];

  buckets.forEach((bucket, slot) => {
    if (!('unassigned' in bucket)) return;
    const entry = unassignedItems[bucket.unassigned];
    entry.price = subtotals[slot] / 100;
    entry.withCharges = amountCents(slot) / 100;
  });

  const settlementPeople: SettlementPerson[] = people.map((person, index) => {
    const items: PersonBreakdown['items'] = [];
    splits.forEach((split, itemIndex) => {
      const cents = split.cents.get(index);
      if (cents === undefined) return;
      const portion = split.shares.get(index) ?? { shares: 1, outOf: 1 };
      items.push({ name: receipt.items[itemIndex].name, ...portion, cost: cents / 100 });
    });
    const breakdown: PersonBreakdown = {
      items,
      itemsSubtotal: subtotals[index] / 100,
      proportion: itemsCents > 0 ? subtotals[index] / itemsCents : 0,
      discount: discounts[index] / 100,
      tax: taxes[index] / 100,
      serviceCharge: services[index] / 100,
      rounding: roundings[index] / 100,
    };
    const name = person.name.trim() || `Person ${index + 1}`;
    return { id: person.id, name, amount: amountCents(index) / 100, breakdown };
  });

  return { settlementPeople, unassignedItems };
}
