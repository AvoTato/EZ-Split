import type { ParsedReceipt } from './parseReceipt';
import type { Person, SettlementSummarySession } from './receiptSession';

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
};

let groups: Group[] = [];
let nextId = 1;
let nextSettlementId = 1;

export function getGroups() {
  return groups;
}

export function setGroups(list: Group[]) {
  groups = list;
}

export function addGroup(input: Omit<Group, 'id'>) {
  const group: Group = { id: String(nextId++), ...input };
  groups = [...groups, group];
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
  return settlement;
}

export function removeSettlement(groupId: string, settlementId: string) {
  groups = groups.map((group) =>
    group.id === groupId
      ? { ...group, settlements: (group.settlements ?? []).filter((s) => s.id !== settlementId) }
      : group,
  );
}

export function updateGroup(groupId: string, input: { name: string; members: Person[] }) {
  groups = groups.map((group) => (group.id === groupId ? { ...group, ...input } : group));
}
