import AsyncStorage from '@react-native-async-storage/async-storage';

import { backupNow, deleteShare, fetchSharesPaid, scheduleBackup } from './cloud';
import { exactBillForPayment, type Payment } from './debts';
import type { ParsedReceipt } from './parseReceipt';
import type { Person, SettlementSummarySession } from './receiptSession';
import { mergePaid } from './shareBill';

export type GroupSettlement = {
  id: string;
  name: string;
  createdAt: number;
  summary: SettlementSummarySession;
  receipt: ParsedReceipt | null;
};

export type Group = {
  id: string;
  name: string;
  members?: Person[];
  settlements?: GroupSettlement[];
  payments?: Payment[];
};

const STORAGE_KEY = 'ez-split/groups/v1';

let groups: Group[] = [];
let nextId = 1;
let nextSettlementId = 1;

const backupPayload = () => ({ version: 1, groups });

function persist() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(groups)).catch(() => {});
  scheduleBackup(backupPayload);
}

export function backupGroupsNow() {
  return backupNow(backupPayload());
}

// Replaces everything on this phone with a backup's contents.
export function restoreGroups(data: unknown) {
  const list = typeof data === 'object' && data !== null ? (data as { groups?: unknown }).groups : undefined;
  if (!Array.isArray(list)) throw new Error('The backup has no groups.');
  groups = list as Group[];
  syncCounters();
  persist();
  return groups.length;
}

function syncCounters() {
  const groupIds = groups.map((group) => Number(group.id));
  const settlementIds = groups.flatMap((group) => (group.settlements ?? []).map((s) => Number(s.id)));
  nextId = Math.max(0, ...groupIds.filter(Number.isFinite)) + 1;
  nextSettlementId = Math.max(0, ...settlementIds.filter(Number.isFinite)) + 1;
}

export async function loadGroups() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) groups = parsed;
    }
  } catch {
    groups = [];
  }
  syncCounters();
  // Catches up on a backup that failed or was cut short last session.
  if (groups.length > 0) scheduleBackup(backupPayload);
}

export function getGroups() {
  return groups;
}

export function setGroups(list: Group[]) {
  groups = list;
  persist();
}

export function addGroup(input: Omit<Group, 'id'>) {
  const group: Group = { id: String(nextId++), ...input };
  groups = [...groups, group];
  persist();
  return group;
}

export function getGroup(groupId: string) {
  return groups.find((group) => group.id === groupId);
}

export function addSettlement(groupId: string, input: Omit<GroupSettlement, 'id'>) {
  const settlement: GroupSettlement = { id: String(nextSettlementId++), ...input };
  groups = groups.map((group) =>
    group.id === groupId
      ? { ...group, settlements: [...(group.settlements ?? []), settlement] }
      : group,
  );
  persist();
  return settlement;
}

// Takes down share links so removed bills stop being viewable. Best effort.
function revokeShares(settlements: GroupSettlement[]) {
  settlements.forEach((settlement) => {
    if (settlement.summary.shareId) deleteShare(settlement.summary.shareId).catch(() => {});
  });
}

export function removeGroup(groupId: string) {
  revokeShares(getGroup(groupId)?.settlements ?? []);
  groups = groups.filter((group) => group.id !== groupId);
  persist();
}

// Pulls "I've paid" taps made on share links into this group's bills.
// Only ever adds paid marks. Returns whether anything changed.
export async function pullSharedPaid(groupId: string) {
  const shared = (getGroup(groupId)?.settlements ?? []).filter((s) => s.summary.shareId);
  if (shared.length === 0) return false;
  const remote = await fetchSharesPaid(shared.map((s) => s.summary.shareId as string));

  let changed = false;
  shared.forEach(({ id }) => {
    // Re-read: the bill may have changed while the request was out.
    const latest = getGroup(groupId)?.settlements?.find((s) => s.id === id);
    const paidIds = latest?.summary.shareId ? remote[latest.summary.shareId] : undefined;
    if (!latest || !paidIds) return;
    const merged = mergePaid(latest.summary, paidIds);
    if ((merged?.length ?? 0) !== (latest.summary.settledIds?.length ?? 0)) {
      updateSettlementSummary(groupId, id, { settledIds: merged });
      changed = true;
    }
  });
  return changed;
}

export function removeSettlement(groupId: string, settlementId: string) {
  revokeShares(getGroup(groupId)?.settlements?.filter((s) => s.id === settlementId) ?? []);
  groups = groups.map((group) =>
    group.id === groupId
      ? { ...group, settlements: (group.settlements ?? []).filter((s) => s.id !== settlementId) }
      : group,
  );
  persist();
}

export function updateSettlementSummary(
  groupId: string,
  settlementId: string,
  patch: Partial<SettlementSummarySession>,
) {
  groups = groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          settlements: (group.settlements ?? []).map((s) =>
            s.id === settlementId ? { ...s, summary: { ...s.summary, ...patch } } : s,
          ),
        }
      : group,
  );
  persist();
}

export function addPayment(groupId: string, input: Pick<Payment, 'fromId' | 'toId' | 'amount'>) {
  const payment: Payment = { id: `${Date.now()}`, createdAt: Date.now(), ...input };
  groups = groups.map((group) =>
    group.id === groupId ? { ...group, payments: [...(group.payments ?? []), payment] } : group,
  );
  persist();
  return payment;
}

export function removePayment(groupId: string, paymentId: string) {
  groups = groups.map((group) =>
    group.id === groupId
      ? { ...group, payments: (group.payments ?? []).filter((payment) => payment.id !== paymentId) }
      : group,
  );
  persist();
}

export function migrateLegacyPayments(groupId: string) {
  const group = getGroup(groupId);
  const payments = group?.payments ?? [];
  if (!group || payments.length === 0) return { migrated: 0, unmatched: 0 };

  let settlements = group.settlements ?? [];
  let migrated = 0;
  let unmatched = 0;
  payments.forEach((payment) => {
    const ref = exactBillForPayment(settlements, payment);
    if (!ref) {
      unmatched += 1;
      return;
    }
    settlements = settlements.map((bill) =>
      bill.id === ref.id && !(bill.summary.settledIds ?? []).includes(payment.fromId)
        ? {
            ...bill,
            summary: { ...bill.summary, settledIds: [...(bill.summary.settledIds ?? []), payment.fromId] },
          }
        : bill,
    );
    migrated += 1;
  });

  groups = groups.map((item) =>
    item.id === groupId ? { ...item, settlements, payments: undefined } : item,
  );
  persist();
  return { migrated, unmatched };
}

export function updateGroup(groupId: string, input: { name: string; members: Person[] }) {
  groups = groups.map((group) => (group.id === groupId ? { ...group, ...input } : group));
  persist();
}
