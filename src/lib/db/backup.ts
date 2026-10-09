import type { EntityTable, IDType } from "dexie";
import { getClientId } from "@/lib/client-id";
import { getOwnerId, sameOwner } from "@/lib/db/owner";
import { db } from "@/lib/db/schema";
import { remoteWins } from "@/lib/sync/schema-compat";
import type {
  CloudAccount,
  CloudBook,
  CloudBudget,
  CloudCategory,
  CloudHolding,
  CloudRecurringRule,
  CloudTemplate,
  CloudTransaction,
  SyncMeta,
} from "@/lib/types";

export const BACKUP_VERSION = 3;

export interface RecordBackup {
  version: number;
  exported_at: string;
  books: CloudBook[];
  accounts: CloudAccount[];
  categories: CloudCategory[];
  transactions: CloudTransaction[];
  budgets: CloudBudget[];
  templates: CloudTemplate[];
  holdings: CloudHolding[];
  /** Absent on backups exported before monthly rules existed. */
  recurring_rules?: CloudRecurringRule[];
}

const TABLE_KEYS = [
  "books",
  "accounts",
  "categories",
  "transactions",
  "budgets",
  "templates",
  "holdings",
  "recurring_rules",
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
  const ownerId = getOwnerId();
  const owned = <T extends { user_id: string | null }>(rows: T[]) =>
    rows.filter((row) => sameOwner(row.user_id, ownerId));
  const [books, accounts, categories, transactions, budgets, templates, holdings, recurringRules] =
    await Promise.all([
      db.books.toArray().then(owned),
      db.accounts.toArray().then(owned),
      db.categories.toArray().then(owned),
      db.transactions.toArray().then(owned),
      db.budgets.toArray().then(owned),
      db.templates.toArray().then(owned),
      db.holdings.toArray().then(owned),
      db.recurring_rules.toArray().then(owned),
    ]);

  const payload: RecordBackup = {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    books: books.map(stripSyncStatus),
    accounts: accounts.map(stripSyncStatus),
    categories: categories.map(stripSyncStatus),
    transactions: transactions.map(stripSyncStatus),
    budgets: budgets.map(stripSyncStatus),
    templates: templates.map(stripSyncStatus),
    holdings: holdings.map(stripSyncStatus),
    recurring_rules: recurringRules.map(stripSyncStatus),
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
  present: Set<TableKey>;
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
    recurring_rules: [],
  } as Record<TableKey, ImportRow[]>;

  const present = new Set<TableKey>();
  let hasAnyTable = false;
  for (const key of TABLE_KEYS) {
    const value = record[key];
    if (value === undefined || value === null) continue;
    if (!Array.isArray(value)) {
      invalid(`${key} 必須是陣列`);
    }
    hasAnyTable = true;
    present.add(key);
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
    present,
    rows,
  };
}

function normalise(
  row: ImportRow,
  clientId: string,
  ownerId: string | null,
) {
  return {
    ...row,
    id: row.id,
    updated_at: row.updated_at,
    user_id: ownerId,
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
  ownerId: string | null,
): Promise<number> {
  if (!rows.length) return 0;

  const prepared: T[] = [];
  if (mode === "merge") {
    // SyncMeta pins `id` to string, but TS cannot narrow IDType for generic T.
    const ids = rows.map((row) => row.id) as IDType<T, "id">[];
    const existing = await table.bulkGet(ids);
    rows.forEach((row, index) => {
      const local = existing[index];
      // Keep local when it is the same age or newer so a re-import does not
      // mark the whole dataset pending and re-push it over the cloud.
      if (local && remoteWins(local.updated_at, row.updated_at)) return;
      prepared.push(normalise(row, clientId, ownerId) as unknown as T);
    });
  } else {
    for (const row of rows) {
      prepared.push(normalise(row, clientId, ownerId) as unknown as T);
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

  const { rows, present } = parseBackup(json);
  const clientId = getClientId();
  const ownerId = getOwnerId();
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
      db.recurring_rules,
      db.sync_state,
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
        // Older files omit the table. Leave local rules in place then.
        if (present.has("recurring_rules")) await db.recurring_rules.clear();
        // Force a full pull after replace so cloud rows missing from the file
        // come back instead of leaving this device on a stale incremental cursor.
        if (ownerId) await db.sync_state.delete(`user:${ownerId}`);
        else await db.sync_state.delete("default");
      }

      imported += await writeRows(db.books, rows.books, mode, clientId, ownerId);
      imported += await writeRows(db.accounts, rows.accounts, mode, clientId, ownerId);
      imported += await writeRows(
        db.categories,
        rows.categories,
        mode,
        clientId,
        ownerId,
      );
      imported += await writeRows(
        db.transactions,
        rows.transactions,
        mode,
        clientId,
        ownerId,
      );
      imported += await writeRows(db.budgets, rows.budgets, mode, clientId, ownerId);
      imported += await writeRows(db.templates, rows.templates, mode, clientId, ownerId);
      imported += await writeRows(db.holdings, rows.holdings, mode, clientId, ownerId);
      imported += await writeRows(
        db.recurring_rules,
        rows.recurring_rules,
        mode,
        clientId,
        ownerId,
      );
    },
  );

  return { imported };
}
