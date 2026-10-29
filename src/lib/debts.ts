import type { SettlementSummarySession } from './receiptSession';

export type Payment = {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  createdAt: number;
};

export type Transfer = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
};

export type Balance = {
  id: string;
  name: string;
  cents: number;
};

type SettlementLike = { summary: SettlementSummarySession };

const toCents = (value: number) => Math.round(value * 100);

export function computeBalances(
  settlements: SettlementLike[],
  payments: Payment[] = [],
  members: { id: string; name: string }[] = [],
): Balance[] {
  const balances = new Map<string, Balance>();
  const touch = (id: string, name: string) => {
    const existing = balances.get(id);
    if (existing) {
      existing.name = name;
      return existing;
    }
    const created = { id, name, cents: 0 };
    balances.set(id, created);
    return created;
  };

  members.forEach((member) => touch(member.id, member.name));

  settlements.forEach(({ summary }) => {
    const payer = summary.people.find((person) => person.id === summary.paidBy);
    if (!payer) return;
    summary.people.forEach((person) => {
      touch(person.id, person.name);
      if (person.id === payer.id || summary.settledIds?.includes(person.id)) return;
      const cents = toCents(person.amount);
      touch(person.id, person.name).cents -= cents;
      touch(payer.id, payer.name).cents += cents;
    });
  });

  payments.forEach((payment) => {
    const cents = toCents(payment.amount);
    const from = balances.get(payment.fromId);
    const to = balances.get(payment.toId);
    if (from) from.cents += cents;
    if (to) to.cents -= cents;
  });

  return [...balances.values()];
}

export function simplifyDebts(balances: Balance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.cents < 0)
    .map((b) => ({ ...b, cents: -b.cents }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = balances
    .filter((b) => b.cents > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.cents - a.cents);

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    const cents = Math.min(debtor.cents, creditor.cents);

    if (cents > 0) {
      transfers.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: cents / 100,
      });
    }

    debtor.cents -= cents;
    creditor.cents -= cents;
    if (debtor.cents === 0) d += 1;
    if (creditor.cents === 0) c += 1;
  }

  return transfers;
}

export function settlementProgress(transfers: Transfer[], payments: { amount: number }[]) {
  const settled = payments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
  const remaining = transfers.reduce((sum, transfer) => sum + toCents(transfer.amount), 0);
  const total = settled + remaining;
  return {
    settled: settled / 100,
    remaining: remaining / 100,
    total: total / 100,
    fraction: total === 0 ? 0 : settled / total,
  };
}

export function payBackStatus(summary: SettlementSummarySession) {
  const payer = summary.people.find((person) => person.id === summary.paidBy) ?? null;
  const settled = new Set(summary.settledIds ?? []);
  const friends = payer
    ? summary.people
        .filter((person) => person.id !== payer.id)
        .map((person) => ({
          id: person.id,
          name: person.name,
          amount: person.amount,
          paidBack: settled.has(person.id),
        }))
    : [];
  const remaining =
    friends.filter((friend) => !friend.paidBack).reduce((sum, friend) => sum + toCents(friend.amount), 0) / 100;
  return {
    payer,
    friends,
    paidBackCount: friends.filter((friend) => friend.paidBack).length,
    remaining,
  };
}

export function reminderSessionFor(transfer: Transfer): SettlementSummarySession {
  return {
    note: '',
    paidBy: transfer.toId,
    people: [
      { id: transfer.toId, name: transfer.toName, amount: 0 },
      { id: transfer.fromId, name: transfer.fromName, amount: transfer.amount },
    ],
  };
}

export type BillRef = { id: string; name: string; createdAt: number };

type BillLike = BillRef & { summary: SettlementSummarySession };

export type SettledEntry = {
  key: string;
  kind: 'payment' | 'bill';
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  amount: number;
  bills: BillRef[];
  paidAt: number | null;
  paymentId?: string;
  settlementId?: string;
  sortAt: number;
};

const toRef = ({ id, name, createdAt }: BillLike): BillRef => ({ id, name, createdAt });

export function billsForPayment(bills: BillLike[], payment: Payment): BillRef[] {
  const shareOf = (bill: BillLike) => {
    const { people, paidBy } = bill.summary;
    const person = people.find((p) => p.id === payment.fromId);
    return person && paidBy && person.id !== paidBy && person.amount > 0 ? person.amount : null;
  };
  const candidates = bills
    .filter((bill) => shareOf(bill) !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
  const toPayee = candidates.filter((bill) => bill.summary.paidBy === payment.toId);
  const pool = toPayee.length > 0 ? toPayee : candidates;
  const exact = pool.filter((bill) => toCents(shareOf(bill) ?? 0) === toCents(payment.amount));
  return (exact.length > 0 ? exact : pool).map(toRef);
}

export function settledEntries(
  bills: BillLike[],
  payments: Payment[],
  names: Record<string, string> = {},
): SettledEntry[] {
  const entries: SettledEntry[] = payments.map((payment) => ({
    key: `payment-${payment.id}`,
    kind: 'payment',
    fromId: payment.fromId,
    toId: payment.toId,
    fromName: names[payment.fromId] ?? 'Someone',
    toName: names[payment.toId] ?? 'Someone',
    amount: payment.amount,
    bills: billsForPayment(bills, payment),
    paidAt: payment.createdAt,
    paymentId: payment.id,
    sortAt: payment.createdAt,
  }));

  bills.forEach((bill) => {
    const { people, paidBy, settledIds } = bill.summary;
    const payer = people.find((person) => person.id === paidBy);
    if (!payer || !settledIds) return;
    people.forEach((person) => {
      if (person.id === payer.id || person.amount <= 0 || !settledIds.includes(person.id)) return;
      entries.push({
        key: `bill-${bill.id}-${person.id}`,
        kind: 'bill',
        fromId: person.id,
        toId: payer.id,
        fromName: person.name,
        toName: payer.name,
        amount: person.amount,
        bills: [toRef(bill)],
        paidAt: null,
        settlementId: bill.id,
        sortAt: bill.createdAt,
      });
    });
  });

  return entries.sort((a, b) => b.sortAt - a.sortAt);
}

export function exactBillForPayment(bills: BillLike[], payment: Payment): BillRef | null {
  const refs = billsForPayment(bills, payment);
  if (refs.length !== 1) return null;
  const bill = bills.find((item) => item.id === refs[0].id);
  const share = bill?.summary.people.find((person) => person.id === payment.fromId)?.amount;
  return share !== undefined && toCents(share) === toCents(payment.amount) ? refs[0] : null;
}

export type BillFriend = { id: string; name: string; amount: number; paidBack: boolean };

export type BillSection = BillRef & {
  hasPayer: boolean;
  payer: { id: string; name: string } | null;
  total: number;
  friends: BillFriend[];
  paidBackCount: number;
  remaining: number;
  allPaid: boolean;
};

export function billSections(bills: BillLike[]): BillSection[] {
  return [...bills]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((bill) => {
      const status = payBackStatus(bill.summary);
      const friends = status.friends
        .filter((friend) => friend.amount > 0)
        .sort((a, b) => Number(a.paidBack) - Number(b.paidBack));
      const remaining =
        friends.filter((friend) => !friend.paidBack).reduce((sum, friend) => sum + toCents(friend.amount), 0) / 100;
      return {
        ...toRef(bill),
        hasPayer: status.payer !== null,
        payer: status.payer ? { id: status.payer.id, name: status.payer.name } : null,
        total: bill.summary.people.reduce((sum, person) => sum + toCents(person.amount), 0) / 100,
        friends,
        paidBackCount: friends.filter((friend) => friend.paidBack).length,
        remaining,
        allPaid: status.payer !== null && remaining === 0,
      };
    });
}

export function overallProgress(sections: BillSection[]) {
  let paid = 0;
  let total = 0;
  sections.forEach((section) => {
    section.friends.forEach((friend) => {
      total += toCents(friend.amount);
      if (friend.paidBack) paid += toCents(friend.amount);
    });
  });
  return { paid: paid / 100, total: total / 100, fraction: total === 0 ? 0 : paid / total };
}
