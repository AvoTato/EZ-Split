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
