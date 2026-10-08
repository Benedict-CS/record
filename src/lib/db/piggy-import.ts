import { getClientId } from "@/lib/client-id";
import { createCategory, listAccounts, listCategories } from "@/lib/db/crud";
import { getOwnerId } from "@/lib/db/owner";
import { db } from "@/lib/db/schema";
import { readPiggyHistory, type PiggyDraft } from "@/lib/piggy";
import type { CategoryKind, Transaction } from "@/lib/types";

export type PiggyImportResult = {
  imported: number;
  alreadyThere: number;
  skipped2026: number;
  skippedMonths: string[];
  skippedMonthRows: number;
  firstMonth: string | null;
  lastMonth: string | null;
};

function monthKey(date: string) {
  return date.slice(0, 7);
}

async function occupiedMonths(bookId: string): Promise<Set<string>> {
  const rows = await db.transactions.where("book_id").equals(bookId).toArray();
  const months = new Set<string>();
  for (const row of rows) {
    if (row.deleted_at) continue;
    months.add(monthKey(row.date));
  }
  return months;
}

async function categoryId(
  bookId: string,
  cache: Map<string, string>,
  kind: CategoryKind,
  name: string,
): Promise<string> {
  const key = `${kind}:${name}`;
  const found = cache.get(key);
  if (found) return found;
  const created = await createCategory(bookId, { name, kind });
  cache.set(key, created.id);
  return created.id;
}

function toTransaction(
  bookId: string,
  accountId: string,
  categoryId: string,
  draft: PiggyDraft,
): Transaction {
  const stamp =
    draft.date < "2026-01-01"
      ? new Date(`${draft.date}T12:00:00+08:00`).toISOString()
      : new Date().toISOString();
  return {
    id: draft.id,
    user_id: getOwnerId(),
    updated_at: stamp,
    deleted_at: null,
    client_id: getClientId(),
    sync_status: "pending",
    book_id: bookId,
    type: draft.type,
    amount: draft.amount,
    date: draft.date,
    note: draft.note,
    account_id: accountId,
    category_id: categoryId,
    transfer_account_id: null,
    hold_status: null,
    release_transaction_id: null,
    reimbursable_amount: null,
    reimbursement_status: null,
    holding_id: null,
    tag: null,
    target_holding_id: null,
  };
}

/** Add 2025-and-earlier Piggy rows into this book. 2026 and occupied months stay. */
export async function importPiggyHistory(
  bookId: string,
  text: string,
): Promise<PiggyImportResult> {
  const accounts = await listAccounts(bookId);
  const cash =
    accounts.find((row) => row.type === "cash" && row.name.trim() === "現金") ??
    accounts.find((row) => row.type === "cash");
  if (!cash) throw new Error("這個帳本沒有現金帳戶，所以舊帳還沒寫入");

  const existingCategories = await listCategories(bookId);
  const cache = new Map(
    existingCategories.map((row) => [`${row.kind}:${row.name.trim()}`, row.id]),
  );
  const read = readPiggyHistory(text, await occupiedMonths(bookId));
  const existingIds = new Set(
    (await db.transactions.bulkGet(read.drafts.map((row) => row.id)))
      .filter((row): row is Transaction => Boolean(row))
      .map((row) => row.id),
  );

  const fresh: Transaction[] = [];
  let alreadyThere = 0;
  for (const draft of read.drafts) {
    if (existingIds.has(draft.id)) {
      alreadyThere += 1;
      continue;
    }
    const category = await categoryId(bookId, cache, draft.type, draft.categoryName);
    fresh.push(toTransaction(bookId, cash.id, category, draft));
  }

  const CHUNK = 200;
  await db.transaction("rw", db.transactions, async () => {
    for (let i = 0; i < fresh.length; i += CHUNK) {
      await db.transactions.bulkAdd(fresh.slice(i, i + CHUNK));
    }
  });

  const months = [...new Set(fresh.map((row) => monthKey(row.date)))].sort();
  return {
    imported: fresh.length,
    alreadyThere,
    skipped2026: read.skipped2026,
    skippedMonths: read.skippedMonths,
    skippedMonthRows: read.skippedMonthRows,
    firstMonth: months[0] ?? null,
    lastMonth: months[months.length - 1] ?? null,
  };
}
