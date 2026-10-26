import type { ParsedReceipt, ReceiptItem } from './parseReceipt';
import type { ItemAssignment, Person, SettlementPerson } from './receiptSession';

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

export function computeSettlement(receipt: ParsedReceipt, people: Person[], assignments: ItemAssignment[]) {
  const unassignedItems: { name: string; price: number }[] = [];
  const totalShares = totalSharesByItem(receipt, assignments);

  receipt.items.forEach((item, itemIndex) => {
    const assigned = totalShares[itemIndex];
    if (assigned === 0) {
      unassignedItems.push({ name: item.name, price: item.price });
    } else if (assigned < item.qty) {
      const leftover = item.qty - assigned;
      unassignedItems.push({
        name: `${leftover} of ${item.qty}× ${item.name}`,
        price: (item.price * leftover) / item.qty,
      });
    }
  });

  const perPersonSubtotal = people.map((person) =>
    assignments
      .filter((a) => a.personId === person.id && a.shares > 0)
      .reduce(
        (sum, a) => sum + itemShareCost(receipt.items[a.itemIndex], a.shares, totalShares[a.itemIndex]),
        0
      )
  );

  const assignedSubtotalAcrossAllPeople = perPersonSubtotal.reduce((sum, s) => sum + s, 0);

  const settlementPeople: SettlementPerson[] = people.map((person, index) => {
    const subtotal = perPersonSubtotal[index];
    const personProportion =
      assignedSubtotalAcrossAllPeople > 0 ? subtotal / assignedSubtotalAcrossAllPeople : 0;
    const discount = (receipt.discount ?? 0) * personProportion;
    const tax = (receipt.tax ?? 0) * personProportion;
    const serviceCharge = (receipt.serviceCharge ?? 0) * personProportion;
    const name = person.name.trim() || `Person ${index + 1}`;
    return { id: person.id, name, amount: subtotal - discount + tax + serviceCharge };
  });

  return { settlementPeople, unassignedItems };
}
