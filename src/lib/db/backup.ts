import type { EntityTable, IDType } from "dexie";
import { getClientId } from "@/lib/client-id";
import { db } from "@/lib/db/schema";
import type {
  CloudAccount,
  CloudBook,
  CloudBudget,
  CloudCategory,
  CloudHolding,
  CloudTemplate,
  CloudTransaction,
  SyncMeta,
} from "@/lib/types";

export const BACKUP_VERSION = 2;

export interface LedgerBackup {
  version: number;
  exported_at: string;
  books: CloudBook[];
  accounts: CloudAccount[];
  categories: CloudCategory[];
  transactions: CloudTransaction[];
  budgets: CloudBudget[];
  templates: CloudTemplate[];
  holdings: CloudHolding[];
}

const TABLE_KEYS = [
  "books",
  "accounts",
  "categories",
  "transactions",
  "budgets",
  "templates",
  "holdings",
] as const;

type TableKey = (typeof TABLE_KEYS)[number];

function stripSyncStatus<T extends { sync_status?: unknown }>(row: T) {
  const { sync_status, ...rest } = row;
  void sync_status; // Pulled out of the object only to discard it.
  return rest;
}

/**
 * Full local snapshot. Soft-deleted rows are included so tombstones survive a
 * restore; `sync_status` is dropped because it is a device-local concern.
 */
export async function exportBackup(): Promise<string> {
  const [books, accounts, categories, transactions, budgets, templates, holdings] =
    await Promise.all([
      db.books.toArray(),
      db.accounts.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.budgets.toArray(),
      db.templates.toArray(),
      db.holdings.toArray(),
    ]);

  const payload: LedgerBackup = {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    books: books.map(stripSyncStatus),
    accounts: accounts.map(stripSyncStatus),
    categories: categories.map(stripSyncStatus),
    transactions: transactions.map(stripSyncStatus),
    budgets: budgets.map(stripSyncStatus),
    templates: templates.map(stripSyncStatus),
    holdings: holdings.map(stripSyncStatus),
  };

  return JSON.stringify(payload);
}

type ImportRow = Record<string, unknown> & { id: string; updated_at: string };

function invalid(message: string): never {
  throw new Error(`備份檔格式不正確：${message}`);
}

function parseBackup(json: string): {
  version: number;
  exported_at: string;
  rows: Record<TableKey, ImportRow[]>;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    invalid("不是有效的 JSON");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    invalid("最外層必須是物件");
  }

  const record = parsed as Record<string, unknown>;

  if (typeof record.version !== "number") {
    invalid("缺少 version 欄位");
  }
  if (record.version > BACKUP_VERSION) {
    invalid(`版本 ${record.version} 太新，請先更新應用程式`);
  }

  const rows = {
    books: [],
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    templates: [],
    holdings: [],
  } as Record<TableKey, ImportRow[]>;

  let hasAnyTable = false;
  for (const key of TABLE_KEYS) {
    const value = record[key];
    if (value === undefined || value === null) continue;
    if (!Array.isArray(value)) {
      invalid(`${key} 必須是陣列`);
    }
    hasAnyTable = true;
    for (const row of value) {
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        invalid(`${key} 內含非物件資料`);
      }
      const candidate = row as Record<string, unknown>;
      if (typeof candidate.id !== "string" || !candidate.id) {
        invalid(`${key} 有資料缺少 id`);
      }
      if (typeof candidate.updated_at !== "string") {
        invalid(`${key} 有資料缺少 updated_at`);
      }
      rows[key].push(candidate as ImportRow);
    }
  }

  if (!hasAnyTable) {
    invalid("找不到任何資料表");
  }

  return {
    version: record.version,
    exported_at:
      typeof record.exported_at === "string"
        ? record.exported_at
        : new Date().toISOString(),
    rows,
  };
}

function normalise(row: ImportRow, clientId: string) {
  return {
    ...row,
    id: row.id,
    updated_at: row.updated_at,
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
    client_id: typeof row.client_id === "string" ? row.client_id : clientId,
    sync_status: "pending" as const,
  };
}

async function writeRows<T extends SyncMeta>(
  table: EntityTable<T, "id">,
  rows: ImportRow[],
  mode: "merge" | "replace",
  clientId: string,
): Promise<number> {
  if (!rows.length) return 0;

  const prepared: T[] = [];
  if (mode === "merge") {
    // SyncMeta pins `id` to string, but TS cannot narrow IDType for generic T.
    const ids = rows.map((row) => row.id) as IDType<T, "id">[];
    const existing = await table.bulkGet(ids);
    rows.forEach((row, index) => {
      const local = existing[index];
      // Last write wins; ties go to the backup so a re-import is idempotent.
      if (local && local.updated_at > row.updated_at) return;
      prepared.push(normalise(row, clientId) as unknown as T);
    });
  } else {
    for (const row of rows) {
      prepared.push(normalise(row, clientId) as unknown as T);
    }
  }

  if (!prepared.length) return 0;
  await table.bulkPut(prepared);
  return prepared.length;
}

export async function importBackup(
  json: string,
  mode: "merge" | "replace",
): Promise<{ imported: number }> {
  if (mode !== "merge" && mode !== "replace") {
    throw new Error("匯入模式只能是 merge 或 replace");
  }

  const { rows } = parseBackup(json);
  const clientId = getClientId();
  let imported = 0;

  await db.transaction(
    "rw",
    [
      db.books,
      db.accounts,
      db.categories,
      db.transactions,
      db.budgets,
      db.templates,
      db.holdings,
    ],
    async () => {
      if (mode === "replace") {
        await db.books.clear();
        await db.accounts.clear();
        await db.categories.clear();
        await db.transactions.clear();
        await db.budgets.clear();
        await db.templates.clear();
        await db.holdings.clear();
      }

      imported += await writeRows(db.books, rows.books, mode, clientId);
      imported += await writeRows(db.accounts, rows.accounts, mode, clientId);
      imported += await writeRows(
        db.categories,
        rows.categories,
        mode,
        clientId,
      );
      imported += await writeRows(
        db.transactions,
        rows.transactions,
        mode,
        clientId,
      );
      imported += await writeRows(db.budgets, rows.budgets, mode, clientId);
      imported += await writeRows(db.templates, rows.templates, mode, clientId);
      imported += await writeRows(db.holdings, rows.holdings, mode, clientId);
    },
  );

  return { imported };
}
