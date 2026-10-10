/** Local-only receipt id prefix until Storage upload succeeds. */
export const LOCAL_RECEIPT_PREFIX = "local:";

export function localReceiptPath(transactionId: string): string {
  return `${LOCAL_RECEIPT_PREFIX}${transactionId}`;
}

export function isLocalReceiptPath(path: string | null | undefined): boolean {
  return Boolean(path?.startsWith(LOCAL_RECEIPT_PREFIX));
}

export function receiptTransactionId(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith(LOCAL_RECEIPT_PREFIX)) return path.slice(LOCAL_RECEIPT_PREFIX.length);
  const slash = path.lastIndexOf("/");
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  return file.replace(/\.[a-zA-Z0-9]+$/, "") || null;
}

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.72;

/** Shrink a photo so IndexedDB / a later upload stay small. */
export async function compressReceiptFile(file: File): Promise<{
  mime: string;
  dataUrl: string;
}> {
  if (typeof createImageBitmap !== "function" && typeof Image === "undefined") {
    const dataUrl = await readAsDataUrl(file);
    return { mime: file.type || "image/jpeg", dataUrl };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    const dataUrl = await readAsDataUrl(file);
    return { mime: file.type || "image/jpeg", dataUrl };
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { mime: "image/jpeg", dataUrl };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
