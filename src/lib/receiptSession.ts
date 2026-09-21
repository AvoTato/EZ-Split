import type { ParsedReceipt } from './parseReceipt';

let pendingImageBase64: string | null = null;
let parsedReceipt: ParsedReceipt | null = null;

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
