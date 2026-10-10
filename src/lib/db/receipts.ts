import { db } from "@/lib/db/schema";
import { localReceiptPath } from "@/lib/receipt";
import type { ReceiptBlob } from "@/lib/types";

export async function getReceipt(id: string): Promise<ReceiptBlob | undefined> {
  return db.receipts.get(id);
}

export async function putReceipt(input: {
  id: string;
  mime: string;
  dataUrl: string;
}): Promise<string> {
  const row: ReceiptBlob = {
    id: input.id,
    mime: input.mime,
    data_url: input.dataUrl,
    updated_at: new Date().toISOString(),
  };
  await db.receipts.put(row);
  return localReceiptPath(input.id);
}

export async function deleteReceipt(id: string): Promise<void> {
  await db.receipts.delete(id);
}
