import type { ParsedReceipt } from './parseReceipt';
import type { PickedImage } from './pickReceipt';

let pickedImage: PickedImage | null = null;
let pendingImageBase64: string | null = null;
let parsedReceipt: ParsedReceipt | null = null;

export function setPickedImage(image: PickedImage | null) {
  pickedImage = image;
}

export function getPickedImage() {
  return pickedImage;
}

export function setPendingImage(base64: string) {
  pendingImageBase64 = base64;
}

export function takePendingImage() {
  const value = pendingImageBase64;
  pendingImageBase64 = null;
  return value;
}

export function setParsedReceipt(receipt: ParsedReceipt) {
  parsedReceipt = receipt;
}

export function getParsedReceipt() {
  return parsedReceipt;
}

export type Person = {
  id: string;
  name: string;
};

export type GroupSettlementSetup = {
  settlementName: string;
  groupName: string;
  members: Person[];
  groupId?: string;
};

let groupSettlementSetup: GroupSettlementSetup | null = null;

export function setGroupSettlementSetup(setup: GroupSettlementSetup | null) {
  groupSettlementSetup = setup;
}

export function getGroupSettlementSetup() {
  return groupSettlementSetup;
}

export type ItemAssignment = {
  itemIndex: number;
  personId: string;
  shares: number;
};

export type WhoHadWhatSession = {
  people: Person[];
  assignments: ItemAssignment[];
};

let whoHadWhatSession: WhoHadWhatSession | null = null;

export function setWhoHadWhatSession(session: WhoHadWhatSession) {
  whoHadWhatSession = session;
}

export function getWhoHadWhatSession() {
  return whoHadWhatSession;
}

// How one person's amount was reached. Every field is whole cents, and
// itemsSubtotal - discount + tax + serviceCharge + rounding === amount.
export type PersonBreakdown = {
  // `shares` of `outOf` portions of the line, e.g. 1 of 2 for a shared dish.
  items: { name: string; shares: number; outOf: number; cost: number }[];
  itemsSubtotal: number;
  // Share of the receipt's items, used to split discount, tax, service and rounding.
  proportion: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  rounding: number;
};

export type SettlementPerson = {
  id: string;
  name: string;
  amount: number;
  // Missing for equal splits and for settlements saved before breakdowns existed.
  breakdown?: PersonBreakdown;
};

export type UnassignedItem = {
  name: string;
  price: number;
  // The price plus its share of discount, tax, service and rounding.
  withCharges?: number;
};

export type SettlementSummarySession = {
  people: SettlementPerson[];
  note: string;
  unassignedItems?: UnassignedItem[];
  explanation?: string;
  pax?: number;
  paidBy?: string;
  settledIds?: string[];
};

let settlementSummarySession: SettlementSummarySession | null = null;

export function setSettlementSummarySession(session: SettlementSummarySession) {
  settlementSummarySession = session;
}

export function getSettlementSummarySession() {
  return settlementSummarySession;
}
