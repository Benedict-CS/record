import { deleteReceipt, getReceipt, putReceipt } from "@/lib/db/receipts";
import { db } from "@/lib/db/schema";
import { isLocalReceiptPath } from "@/lib/receipt";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "receipts";

export async function pushLocalReceipts(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const rows = await db.receipts.toArray();
  for (const row of rows) {
    const tx = await db.transactions.get(row.id);
    if (!tx || tx.deleted_at) {
      await deleteReceipt(row.id);
      continue;
    }
    if (tx.receipt_path && !isLocalReceiptPath(tx.receipt_path)) continue;
    try {
      const blob = await (await fetch(row.data_url)).blob();
      const path = `${userId}/${row.id}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        upsert: true,
        contentType: row.mime || "image/jpeg",
      });
      if (error) continue;
      await db.transactions.update(row.id, {
        receipt_path: path,
        updated_at: new Date().toISOString(),
        sync_status: "pending",
      });
    } catch {
      // Offline or bucket missing: keep the local photo.
    }
  }
}

export async function pullMissingReceipts(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const rows = await db.transactions
    .where("user_id")
    .equals(userId)
    .filter(
      (row) =>
        Boolean(row.receipt_path) &&
        !row.deleted_at &&
        !isLocalReceiptPath(row.receipt_path),
    )
    .toArray();
  for (const row of rows) {
    if (await getReceipt(row.id)) continue;
    const path = row.receipt_path;
    if (!path) continue;
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(path);
      if (error || !data) continue;
      const dataUrl = await blobToDataUrl(data);
      await putReceipt({
        id: row.id,
        mime: data.type || "image/jpeg",
        dataUrl,
      });
    } catch {
      // Fine: the list can still show a 收據 mark without the bytes.
    }
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}
