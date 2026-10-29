import type { SettlementSummarySession } from './receiptSession';

type SettlementLike = {
  name: string;
  createdAt: number;
  summary: SettlementSummarySession;
};

export type MonthTotal = {
  key: string;
  label: string;
  total: number;
};

export type Insights = {
  billCount: number;
  thisMonthTotal: number;
  thisMonthCount: number;
  averageBill: number;
  months: MonthTotal[];
  biggestBill: { name: string; total: number } | null;
  topPayer: { name: string; count: number } | null;
  topSpender: { name: string; total: number } | null;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;
const toCents = (value: number) => Math.round(value * 100);

export function billTotal(summary: SettlementSummarySession) {
  return summary.people.reduce((sum, person) => sum + toCents(person.amount), 0) / 100;
}

export function computeInsights(
  settlements: SettlementLike[],
  now: Date = new Date(),
  monthCount = 6,
): Insights {
  const months: MonthTotal[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(date), label: MONTH_LABELS[date.getMonth()], total: 0 });
  }

  const payerCounts = new Map<string, { name: string; count: number }>();
  const spenderCents = new Map<string, { name: string; cents: number }>();
  let biggestBill: Insights['biggestBill'] = null;
  let allCents = 0;
  let thisMonthCents = 0;
  let thisMonthCount = 0;
  const monthCents = new Map<string, number>();

  settlements.forEach((settlement) => {
    const total = billTotal(settlement.summary);
    const cents = toCents(total);
    allCents += cents;

    const key = monthKey(new Date(settlement.createdAt));
    monthCents.set(key, (monthCents.get(key) ?? 0) + cents);
    if (key === monthKey(now)) {
      thisMonthCents += cents;
      thisMonthCount += 1;
    }

    if (!biggestBill || total > biggestBill.total) {
      biggestBill = { name: settlement.name, total };
    }

    const payer = settlement.summary.people.find((p) => p.id === settlement.summary.paidBy);
    if (payer) {
      const entry = payerCounts.get(payer.id) ?? { name: payer.name, count: 0 };
      entry.name = payer.name;
      entry.count += 1;
      payerCounts.set(payer.id, entry);
    }

    settlement.summary.people.forEach((person) => {
      const entry = spenderCents.get(person.id) ?? { name: person.name, cents: 0 };
      entry.name = person.name;
      entry.cents += toCents(person.amount);
      spenderCents.set(person.id, entry);
    });
  });

  months.forEach((month) => {
    month.total = (monthCents.get(month.key) ?? 0) / 100;
  });

  const topPayer = [...payerCounts.values()].sort((a, b) => b.count - a.count)[0] ?? null;
  const spender = [...spenderCents.values()].sort((a, b) => b.cents - a.cents)[0];

  return {
    billCount: settlements.length,
    thisMonthTotal: thisMonthCents / 100,
    thisMonthCount,
    averageBill: settlements.length === 0 ? 0 : Math.round(allCents / settlements.length) / 100,
    months,
    biggestBill,
    topPayer,
    topSpender: spender ? { name: spender.name, total: spender.cents / 100 } : null,
  };
}
