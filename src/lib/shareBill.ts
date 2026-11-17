import type { SettlementSummarySession } from './receiptSession';

// What a share link shows: who is on the bill, what each owes, and who paid.
// Mirrors the Bill type validated in server/src/store.ts.
export type SharedBill = {
  title?: string;
  currency: string;
  payerId?: string;
  people: { id: string; name: string; amount: number }[];
};

export function billSnapshot(
  session: SettlementSummarySession,
  title: string | undefined,
  currency: string,
): SharedBill {
  const payerKnown = session.people.some((person) => person.id === session.paidBy);
  const trimmedTitle = title?.trim().slice(0, 120);
  return {
    ...(trimmedTitle ? { title: trimmedTitle } : {}),
    currency,
    ...(payerKnown ? { payerId: session.paidBy } : {}),
    people: session.people.map(({ id, name, amount }) => ({ id, name: name.trim().slice(0, 80) || '?', amount })),
  };
}

// Adds people who marked themselves paid on the link to the app's paid list.
// Only people on the bill who aren't the payer count. Returns undefined when nobody
// has paid, matching how settledIds is stored.
export function mergePaid(
  session: Pick<SettlementSummarySession, 'people' | 'paidBy' | 'settledIds'>,
  remoteIds: string[],
): string[] | undefined {
  const allowed = new Set(session.people.map((person) => person.id).filter((id) => id !== session.paidBy));
  const merged = [...(session.settledIds ?? [])];
  for (const id of remoteIds) {
    if (allowed.has(id) && !merged.includes(id)) merged.push(id);
  }
  return merged.length > 0 ? merged : undefined;
}

export function withShareLink(text: string, url: string | null) {
  return url ? `${text}\n\nSee the bill and mark yourself paid: ${url}` : text;
}
