import type { Person } from './receiptSession';

export type Group = {
  id: string;
  name: string;
  members?: Person[];
};

let groups: Group[] = [];
let nextId = 1;

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
