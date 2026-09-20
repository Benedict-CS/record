import { claimLocalRowsForUser } from "@/lib/db/crud";
import { db } from "@/lib/db/schema";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  CloudAccount,
  CloudBook,
  CloudBudget,
  CloudCategory,
  CloudHolding,
  CloudTemplate,
  CloudTransaction,
  SyncStatus,
  SyncUiStatus,
} from "@/lib/types";

type Listener = (status: SyncUiStatus, message?: string) => void;

const listeners = new Set<Listener>();
let currentStatus: SyncUiStatus = "local";
let currentMessage: string | undefined;
let syncing = false;

export function getSyncStatus() {
  return { status: currentStatus, message: currentMessage };
}

export function subscribeSyncStatus(listener: Listener) {
  listeners.add(listener);
  listener(currentStatus, currentMessage);
  return () => {
    listeners.delete(listener);
  };
}

function setStatus(status: SyncUiStatus, message?: string) {
  currentStatus = status;
  currentMessage = message;
  listeners.forEach((listener) => listener(status, message));
}

function formatSyncError(error: unknown, context?: string): string {
  const prefix = context ? `${context}：` : "";
  if (!error || typeof error !== "object") {
    return `${prefix}同步失敗，請稍後再試`;
  }
  const row = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };
  const parts = [row.message, row.details, row.hint, row.code ? `(${row.code})` : ""]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  if (parts.length) return `${prefix}${parts.join(" ")}`;
  if (error instanceof Error && error.message) {
    return `${prefix}${error.message}`;
  }
  return `${prefix}同步失敗，請稍後再試`;
}

function stripSyncStatus<T extends { sync_status: SyncStatus }>(
  row: T,
): Omit<T, "sync_status"> {
  const { sync_status, ...rest } = row;
  void sync_status; // Pulled out of the object only to discard it.
  return rest;
}

/**
 * After collapse, if the stored active book is empty (or gone) but another live
 * book of the same currency has txs, adopt that id so web lands on KEEP.
 */
async function preferCanonicalActiveBook() {
  if (typeof localStorage === "undefined") return;
  const activeId = localStorage.getItem("ledger_active_book_id");
  const live = (await db.books.toArray()).filter((row) => !row.deleted_at);
  if (live.length === 0) return;

  const active = activeId ? live.find((row) => row.id === activeId) : null;
  const activeCount = active
    ? await db.transactions
        .where("book_id")
        .equals(active.id)
        .filter((row) => !row.deleted_at)
        .count()
    : 0;

  if (active && activeCount > 0) return;

  const currency = active?.currency ?? "TWD";
  const candidates = live.filter((row) => row.currency === currency);
  let best: { id: string; count: number } | null = null;
  for (const book of candidates.length ? candidates : live) {
    const count = await db.transactions
      .where("book_id")
      .equals(book.id)
      .filter((row) => !row.deleted_at)
      .count();
    if (!best || count > best.count) best = { id: book.id, count };
  }
  if (best && best.count > 0 && best.id !== activeId) {
    localStorage.setItem("ledger_active_book_id", best.id);
    window.dispatchEvent(
      new CustomEvent("ledger-active-book", { detail: best.id }),
    );
  } else if (!active) {
    const twd = live.find((row) => row.currency === "TWD");
    const fallback = twd?.id ?? live[0]?.id;
    if (fallback) {
      localStorage.setItem("ledger_active_book_id", fallback);
      window.dispatchEvent(
        new CustomEvent("ledger-active-book", { detail: fallback }),
      );
    }
  }
}

/** Keep one book per currency+name; re-point children so push does not fork books. */
async function collapseDuplicateBooks() {
  const books = (await db.books.toArray()).filter((row) => !row.deleted_at);
  const groups = new Map<string, typeof books>();
  for (const book of books) {
    const key = `${book.currency}\0${book.name.trim()}`;
    const list = groups.get(key) ?? [];
    list.push(book);
    groups.set(key, list);
  }

  const stamp = new Date().toISOString();
  const clientId = "sync-collapse";

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const scored = await Promise.all(
      group.map(async (book) => {
        const txCount = await db.transactions
          .where("book_id")
          .equals(book.id)
          .filter((row) => !row.deleted_at)
          .count();
        return {
          book,
          txCount,
          synced: book.sync_status === "synced" ? 1 : 0,
        };
      }),
    );
    scored.sort((a, b) => {
      // Rows with real transactions beat sync flags — an empty synced seed twin must not win
      // over the cloud KEEP book that actually has Sep transactions.
      if (b.txCount !== a.txCount) return b.txCount - a.txCount;
      if (b.synced !== a.synced) return b.synced - a.synced;
      return a.book.sort_order - b.book.sort_order;
    });

    const keep = scored[0].book;
    for (const { book: extra } of scored.slice(1)) {
      for (const table of [
        db.accounts,
        db.categories,
        db.transactions,
        db.budgets,
        db.templates,
        db.holdings,
      ] as const) {
        const children = await table
          .where("book_id")
          .equals(extra.id)
          .toArray();
        for (const child of children) {
          await table.update(child.id, {
            book_id: keep.id,
            updated_at: stamp,
            client_id: clientId,
            sync_status: "pending",
          });
        }
      }
      await db.books.update(extra.id, {
        deleted_at: stamp,
        updated_at: stamp,
        client_id: clientId,
        sync_status: "pending",
      });
      if (
        typeof localStorage !== "undefined" &&
        localStorage.getItem("ledger_active_book_id") === extra.id
      ) {
        localStorage.setItem("ledger_active_book_id", keep.id);
      }
    }
  }
}

/** Keep one holding per book+name+kind+institution; prefer higher principal. */
async function collapseDuplicateHoldings() {
  const live = (await db.holdings.toArray()).filter((row) => !row.deleted_at);
  const groups = new Map<string, typeof live>();
  for (const row of live) {
    const key = `${row.book_id}\0${row.kind}\0${row.name.trim()}\0${(row.institution ?? "").trim()}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const stamp = new Date().toISOString();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return b.updated_at.localeCompare(a.updated_at);
    });
    for (const extra of group.slice(1)) {
      await db.holdings.update(extra.id, {
        deleted_at: stamp,
        updated_at: stamp,
        sync_status: "pending",
      });
    }
  }
}

async function retireTransfersLocally() {
  // One-shot: after transfers are gone, skip the full-table scan every sync.
  if (
    typeof localStorage !== "undefined" &&
    localStorage.getItem("ledger_retired_transfers_v1") === "1"
  ) {
    return;
  }

  const stamp = new Date().toISOString();
  const transfers = await db.transactions
    .filter((row) => !row.deleted_at && row.type === "transfer")
    .toArray();
  for (const row of transfers) {
    await db.transactions.update(row.id, {
      deleted_at: stamp,
      updated_at: stamp,
      sync_status: "pending",
    });
  }
  const transferTemplates = await db.templates
    .filter((row) => !row.deleted_at && row.type === "transfer")
    .toArray();
  for (const row of transferTemplates) {
    await db.templates.update(row.id, {
      deleted_at: stamp,
      updated_at: stamp,
      sync_status: "pending",
    });
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem("ledger_retired_transfers_v1", "1");
  }
}

/** Remap live txs that still point at soft-deleted accounts onto a live twin. */
async function repairDeadAccountRefs() {
  const stamp = new Date().toISOString();
  const liveAccounts = (await db.accounts.toArray()).filter(
    (row) => !row.deleted_at,
  );
  const liveByBookType = new Map<string, string>();
  for (const account of liveAccounts) {
    const key = `${account.book_id}\0${account.type}`;
    if (!liveByBookType.has(key)) liveByBookType.set(key, account.id);
  }

  const deadIds = new Set(
    (await db.accounts.toArray())
      .filter((row) => row.deleted_at)
      .map((row) => row.id),
  );
  if (deadIds.size === 0) return;

  const txs = await db.transactions
    .filter((row) => !row.deleted_at && deadIds.has(row.account_id))
    .toArray();

  for (const tx of txs) {
    const dead = await db.accounts.get(tx.account_id);
    if (!dead) continue;
    const next = liveByBookType.get(`${tx.book_id}\0${dead.type}`);
    if (!next || next === tx.account_id) continue;
    await db.transactions.update(tx.id, {
      account_id: next,
      updated_at: stamp,
      sync_status: "pending",
    });
  }
}

/** Soft-delete empty placeholder holdings left by old seed defaults. */
async function purgeEmptyHoldings() {
  if (
    typeof localStorage !== "undefined" &&
    localStorage.getItem("ledger_purged_empty_holdings_v1") === "1"
  ) {
    return;
  }

  const stamp = new Date().toISOString();
  const empties = await db.holdings
    .filter((row) => !row.deleted_at && Number(row.amount) === 0)
    .toArray();
  for (const row of empties) {
    await db.holdings.update(row.id, {
      deleted_at: stamp,
      updated_at: stamp,
      sync_status: "pending",
    });
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem("ledger_purged_empty_holdings_v1", "1");
  }
}

/** Remove invented/demo local rows that cloud cleanup cannot match by id. */
async function purgeInventedLocalData() {
  // One-shot migration — do not re-wipe on every sync (zeros TWD counts).
  if (typeof localStorage !== "undefined") {
    if (localStorage.getItem("ledger_purged_demo_v1") === "1") return;
  }

  const stamp = new Date().toISOString();
  const junk = await db.transactions
    .filter((row) => {
      if (row.deleted_at) return false;
      if (row.note.includes("示範")) return true;
      return false;
    })
    .toArray();

  for (const row of junk) {
    await db.transactions.update(row.id, {
      deleted_at: stamp,
      updated_at: stamp,
      sync_status: "pending",
    });
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem("ledger_purged_demo_v1", "1");
  }
}

async function mergeRemoteBooks(remoteRows: CloudBook[]) {
  if (!remoteRows.length) return;
  const locals = await db.books.bulkGet(remoteRows.map((row) => row.id));
  const toPut: CloudBook[] = [];
  for (let i = 0; i < remoteRows.length; i += 1) {
    const remote = remoteRows[i];
    const local = locals[i];
    if (!local || remote.updated_at >= local.updated_at) {
      toPut.push(remote);
    }
  }
  if (toPut.length) {
    await db.books.bulkPut(
      toPut.map((row) => ({ ...row, sync_status: "synced" as const })),
    );
  }
}

async function mergeRemoteAccounts(remoteRows: CloudAccount[]) {
  if (!remoteRows.length) return;
  const locals = await db.accounts.bulkGet(remoteRows.map((row) => row.id));
  const toPut: Array<CloudAccount & { opening_balance: number }> = [];
  for (let i = 0; i < remoteRows.length; i += 1) {
    const remote = remoteRows[i];
    const normalised = {
      ...remote,
      opening_balance: Number(remote.opening_balance ?? 0),
    };
    const local = locals[i];
    if (
      local?.sync_status === "pending" &&
      local.deleted_at &&
      !remote.deleted_at &&
      local.updated_at >= remote.updated_at
    ) {
      continue;
    }
    if (!local || remote.updated_at >= local.updated_at) {
      toPut.push(normalised);
    }
  }
  if (toPut.length) {
    await db.accounts.bulkPut(
      toPut.map((row) => ({ ...row, sync_status: "synced" as const })),
    );
  }
}

async function mergeRemoteCategories(remoteRows: CloudCategory[]) {
  if (!remoteRows.length) return;
  const locals = await db.categories.bulkGet(remoteRows.map((row) => row.id));
  const toPut: Array<CloudCategory & { color: string }> = [];
  for (let i = 0; i < remoteRows.length; i += 1) {
    const remote = remoteRows[i];
    const withColor = {
      ...remote,
      color: remote.color || "#0f7a5f",
    };
    const local = locals[i];
    if (
      local?.sync_status === "pending" &&
      local.deleted_at &&
      !remote.deleted_at &&
      local.updated_at >= remote.updated_at
    ) {
      continue;
    }
    if (!local || remote.updated_at >= local.updated_at) {
      toPut.push(withColor);
    }
  }
  if (toPut.length) {
    await db.categories.bulkPut(
      toPut.map((row) => ({ ...row, sync_status: "synced" as const })),
    );
  }
}

async function mergeRemoteTransactions(remoteRows: CloudTransaction[]) {
  if (!remoteRows.length) return;
  const locals = await db.transactions.bulkGet(
    remoteRows.map((row) => row.id),
  );
  const toPut: CloudTransaction[] = [];
  for (let i = 0; i < remoteRows.length; i += 1) {
    const remote = remoteRows[i];
    const normalised: CloudTransaction = {
      ...remote,
      amount: Number(remote.amount),
      hold_status: (remote.hold_status ??
        null) as CloudTransaction["hold_status"],
      release_transaction_id: remote.release_transaction_id ?? null,
      reimbursable_amount:
        remote.reimbursable_amount == null
          ? null
          : Number(remote.reimbursable_amount),
      reimbursement_status: (remote.reimbursement_status ??
        null) as CloudTransaction["reimbursement_status"],
    };
    const local = locals[i];
    if (!local || remote.updated_at >= local.updated_at) {
      toPut.push(normalised);
    }
  }
  if (toPut.length) {
    await db.transactions.bulkPut(
      toPut.map((row) => ({ ...row, sync_status: "synced" as const })),
    );
  }
}

async function mergeRemoteBudgets(remoteRows: CloudBudget[]) {
  if (!remoteRows.length) return;
  const locals = await db.budgets.bulkGet(remoteRows.map((row) => row.id));
  const toPut: CloudBudget[] = [];
  for (let i = 0; i < remoteRows.length; i += 1) {
    const remote = remoteRows[i];
    const local = locals[i];
    if (local?.sync_status === "pending") continue;
    if (!local || remote.updated_at >= local.updated_at) {
      toPut.push({ ...remote, amount: Number(remote.amount) });
    }
  }
  if (toPut.length) {
    await db.budgets.bulkPut(
      toPut.map((row) => ({ ...row, sync_status: "synced" as const })),
    );
  }
}

async function mergeRemoteTemplates(remoteRows: CloudTemplate[]) {
  if (!remoteRows.length) return;
  const locals = await db.templates.bulkGet(remoteRows.map((row) => row.id));
  const toPut: CloudTemplate[] = [];
  for (let i = 0; i < remoteRows.length; i += 1) {
    const remote = remoteRows[i];
    const normalised = { ...remote, amount: Number(remote.amount) };
    const local = locals[i];
    if (local?.sync_status === "pending") continue;
    if (!local || remote.updated_at >= local.updated_at) {
      toPut.push(normalised);
    }
  }
  if (toPut.length) {
    await db.templates.bulkPut(
      toPut.map((row) => ({ ...row, sync_status: "synced" as const })),
    );
  }
}

async function mergeRemoteHoldings(remoteRows: CloudHolding[]) {
  if (!remoteRows.length) return;
  const locals = await db.holdings.bulkGet(remoteRows.map((row) => row.id));
  const toPut: Array<
    CloudHolding & { amount: number; annual_rate: number }
  > = [];
  for (let i = 0; i < remoteRows.length; i += 1) {
    const remote = remoteRows[i];
    const normalised = {
      ...remote,
      amount: Number(remote.amount),
      annual_rate: Number(remote.annual_rate),
    };
    const local = locals[i];
    if (local?.sync_status === "pending") continue;
    if (!local || remote.updated_at >= local.updated_at) {
      toPut.push(normalised);
    }
  }
  if (toPut.length) {
    await db.holdings.bulkPut(
      toPut.map((row) => ({ ...row, sync_status: "synced" as const })),
    );
  }
}

type PullOptions = { forceFull?: boolean };

async function pullAll(userId: string, options: PullOptions = {}) {
  const supabase = createClient();
  const state = await db.sync_state.get("default");
  const since = state?.last_pulled_at;
  const localTxCount = await db.transactions.count();
  // First sync / empty DB / explicit full: download everything.
  // Later syncs only fetch rows newer than last_pulled_at (much faster).
  const full =
    options.forceFull ||
    !since ||
    localTxCount === 0 ||
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("ledger_force_full_pull") === "1");

  if (
    full &&
    typeof localStorage !== "undefined" &&
    localStorage.getItem("ledger_force_full_pull") === "1"
  ) {
    localStorage.removeItem("ledger_force_full_pull");
  }

  // 2s overlap so rows stamped exactly at last_pulled_at are not skipped.
  const sinceWithOverlap =
    !full && since
      ? new Date(new Date(since).getTime() - 2000).toISOString()
      : null;

  async function fetchTable(table: string) {
    let query = supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true });
    if (sinceWithOverlap) query = query.gt("updated_at", sinceWithOverlap);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  // Parallel network pulls; merge stays sequential by table dependency order.
  const [
    books,
    accounts,
    categories,
    transactions,
    budgets,
    templates,
    holdings,
  ] = await Promise.all([
    fetchTable("books"),
    fetchTable("accounts"),
    fetchTable("categories"),
    fetchTable("transactions"),
    fetchTable("budgets"),
    fetchTable("templates"),
    fetchTable("holdings"),
  ]);

  await mergeRemoteBooks(books as CloudBook[]);
  await mergeRemoteAccounts(accounts as CloudAccount[]);
  await mergeRemoteCategories(categories as CloudCategory[]);
  await mergeRemoteTransactions(transactions as CloudTransaction[]);
  await mergeRemoteBudgets(budgets as CloudBudget[]);
  await mergeRemoteTemplates(templates as CloudTemplate[]);
  await mergeRemoteHoldings(holdings as CloudHolding[]);

  // Defer last_pulled_at until push succeeds so a failed push can re-pull.
  return new Date().toISOString();
}

async function pushPending(userId: string) {
  const supabase = createClient();

  const [books, accounts, categories, transactions, budgets, templates, holdings] =
    await Promise.all([
      db.books.where("sync_status").equals("pending").toArray(),
      db.accounts.where("sync_status").equals("pending").toArray(),
      db.categories.where("sync_status").equals("pending").toArray(),
      db.transactions.where("sync_status").equals("pending").toArray(),
      db.budgets.where("sync_status").equals("pending").toArray(),
      db.templates.where("sync_status").equals("pending").toArray(),
      db.holdings.where("sync_status").equals("pending").toArray(),
    ]);

  // Never push a live empty seed twin when a synced twin already exists —
  // that is how cloud accumulated dozens of dead 台灣帳本 rows.
  const syncedLiveBooks = (await db.books.toArray()).filter(
    (row) => !row.deleted_at && row.sync_status === "synced",
  );
  const syncedKeys = new Set(
    syncedLiveBooks.map((row) => `${row.currency}\0${row.name.trim()}`),
  );

  const ownedBooks = (
    await Promise.all(
      books
        .filter((row) => row.user_id === userId)
        .map(async (row) => {
          if (row.deleted_at) return stripSyncStatus(row);
          const key = `${row.currency}\0${row.name.trim()}`;
          if (
            syncedKeys.has(key) &&
            row.sync_status === "pending" &&
            !syncedLiveBooks.some((s) => s.id === row.id)
          ) {
            const txCount = await db.transactions
              .where("book_id")
              .equals(row.id)
              .filter((tx) => !tx.deleted_at)
              .count();
            if (txCount === 0) {
              // Soft-delete locally instead of uploading a fork.
              const stamp = new Date().toISOString();
              await db.books.update(row.id, {
                deleted_at: stamp,
                updated_at: stamp,
                sync_status: "pending",
              });
              return stripSyncStatus({
                ...row,
                deleted_at: stamp,
                updated_at: stamp,
              });
            }
          }
          return stripSyncStatus(row);
        }),
    )
  );
  const ownedAccounts = accounts
    .filter((row) => row.user_id === userId)
    .map((row) => ({
      ...stripSyncStatus(row),
      opening_balance: Number(row.opening_balance ?? 0),
    }));
  const ownedCategories = categories
    .filter((row) => row.user_id === userId)
    .map((row) => ({
      ...stripSyncStatus(row),
      color: row.color || "#0f7a5f",
    }));
  const ownedTransactions = transactions
    .filter((row) => row.user_id === userId)
    .map((row) => ({
      ...stripSyncStatus(row),
      amount: row.amount,
      hold_status: row.hold_status ?? null,
      release_transaction_id: row.release_transaction_id ?? null,
      reimbursable_amount: row.reimbursable_amount ?? null,
      reimbursement_status: row.reimbursement_status ?? null,
    }));
  const ownedBudgets = budgets
    .filter((row) => row.user_id === userId)
    .map((row) => ({
      ...stripSyncStatus(row),
      amount: row.amount,
    }));
  const ownedTemplates = templates
    .filter((row) => row.user_id === userId)
    .map((row) => ({
      ...stripSyncStatus(row),
      amount: row.amount,
    }));
  const ownedHoldings = holdings
    .filter((row) => row.user_id === userId)
    .map((row) => ({
      ...stripSyncStatus(row),
      amount: row.amount,
      annual_rate: row.annual_rate,
    }));

  const UPSERT_CHUNK = 150;

  async function upsertTable(
    table: string,
    rows: Record<string, unknown>[],
    markSynced: (ids: string[]) => Promise<void>,
  ) {
    if (!rows.length) return;
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK);
      const { error } = await supabase.from(table).upsert(chunk);
      if (error) throw Object.assign(error, { __table: table });
      await markSynced(chunk.map((row) => String(row.id)));
    }
  }

  async function markLocalSynced<T extends { id: string; sync_status: SyncStatus }>(
    table: {
      bulkGet: (keys: string[]) => Promise<Array<T | undefined>>;
      bulkPut: (items: T[]) => Promise<unknown>;
    },
    ids: string[],
  ) {
    const locals = await table.bulkGet(ids);
    const stamped = locals
      .filter((row): row is T => Boolean(row))
      .map((row) => ({ ...row, sync_status: "synced" as const }));
    if (stamped.length) await table.bulkPut(stamped);
  }

  await upsertTable(
    "books",
    ownedBooks as Record<string, unknown>[],
    (ids) => markLocalSynced(db.books, ids),
  );
  await upsertTable(
    "accounts",
    ownedAccounts as Record<string, unknown>[],
    (ids) => markLocalSynced(db.accounts, ids),
  );
  await upsertTable(
    "categories",
    ownedCategories as Record<string, unknown>[],
    (ids) => markLocalSynced(db.categories, ids),
  );
  await upsertTable(
    "transactions",
    ownedTransactions as Record<string, unknown>[],
    (ids) => markLocalSynced(db.transactions, ids),
  );
  await upsertTable(
    "budgets",
    ownedBudgets as Record<string, unknown>[],
    (ids) => markLocalSynced(db.budgets, ids),
  );
  await upsertTable(
    "templates",
    ownedTemplates as Record<string, unknown>[],
    (ids) => markLocalSynced(db.templates, ids),
  );

  const holdingsPayload = ownedHoldings.map((row) => ({
    ...row,
    start_date: row.start_date || new Date().toISOString().slice(0, 10),
    maturity_date: row.maturity_date ?? null,
    note: row.note ?? "",
    color: row.color || "#0f7a5f",
    icon: row.icon || "dots",
    compounding: row.compounding || "none",
    amount: Number(row.amount ?? 0),
    annual_rate: Number(row.annual_rate ?? 0),
  }));
  await upsertTable(
    "holdings",
    holdingsPayload as Record<string, unknown>[],
    (ids) => markLocalSynced(db.holdings, ids),
  );

  const state = await db.sync_state.get("default");
  await db.sync_state.put({
    id: "default",
    last_pulled_at: state?.last_pulled_at ?? null,
    last_pushed_at: new Date().toISOString(),
  });
}

export type RunSyncOptions = {
  /** Download every row (ignore last_pulled_at). Use after bulk cloud edits. */
  forceFull?: boolean;
};

const MAINTENANCE_KEY = "ledger_last_sync_maintenance_at";
const MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h
const AUTO_SYNC_MIN_MS = 45_000;
let lastAutoSyncAt = 0;

function needsMaintenance(forceFull: boolean): boolean {
  if (forceFull) return true;
  if (typeof localStorage === "undefined") return true;
  const last = localStorage.getItem(MAINTENANCE_KEY);
  if (!last) return true;
  return Date.now() - Date.parse(last) > MAINTENANCE_INTERVAL_MS;
}

export async function runSync(options: RunSyncOptions = {}): Promise<void> {
  if (typeof window === "undefined") return;
  if (!navigator.onLine) {
    setStatus("offline");
    return;
  }
  if (!isSupabaseConfigured()) {
    setStatus("local", "尚未設定 Supabase");
    return;
  }
  if (syncing) return;

  const forceFull = Boolean(options.forceFull);
  syncing = true;
  setStatus(
    "syncing",
    forceFull ? "正在完整同步…" : "正在同步…",
  );

  try {
    const state = await db.sync_state.get("default");
    const isFirstPull = !state?.last_pulled_at || forceFull;
    // Seed only when local is empty / first cloud pull — BookProvider already
    // seeds on boot; re-running pin/dedupe on every sync was a major cost.
    if (isFirstPull) {
      const { ensureSeedData } = await import("@/lib/db/seed");
      await ensureSeedData();
    }

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) {
      const msg = (userError.message ?? "").toLowerCase();
      if (
        msg.includes("auth session missing") ||
        msg.includes("session missing")
      ) {
        setStatus("local", "未登入");
        return;
      }
      throw userError;
    }

    if (!user) {
      setStatus("local", "未登入");
      return;
    }

    await claimLocalRowsForUser(user.id);
    const pulledAt = await pullAll(user.id, { forceFull });
    // Cheap when clean; clears empty seed twins that landed next to real holdings.
    await collapseDuplicateHoldings();
    await purgeEmptyHoldings();

    if (needsMaintenance(forceFull)) {
      await collapseDuplicateBooks();
      await repairDeadAccountRefs();
      await preferCanonicalActiveBook();
      await retireTransfersLocally();
      await purgeInventedLocalData();
      await purgeEmptyHoldings();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(MAINTENANCE_KEY, new Date().toISOString());
      }
    }

    await pushPending(user.id);
    const syncState = await db.sync_state.get("default");
    await db.sync_state.put({
      id: "default",
      last_pulled_at: pulledAt,
      last_pushed_at: syncState?.last_pushed_at ?? new Date().toISOString(),
    });
    setStatus("synced");
  } catch (error) {
    const table =
      error && typeof error === "object" && "__table" in error
        ? String((error as { __table?: string }).__table)
        : undefined;
    setStatus("error", formatSyncError(error, table));
  } finally {
    syncing = false;
  }
}

/** Queue a background sync, throttled for visibility/online auto triggers. */
function scheduleAutoSync() {
  const now = Date.now();
  if (now - lastAutoSyncAt < AUTO_SYNC_MIN_MS) return;
  lastAutoSyncAt = now;
  void runSync();
}

export function startSyncListeners() {
  if (typeof window === "undefined") return () => undefined;

  const onOnline = () => {
    scheduleAutoSync();
  };
  const onOffline = () => setStatus("offline");
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      scheduleAutoSync();
    }
  };

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);

  if (!navigator.onLine) {
    setStatus("offline");
  } else {
    lastAutoSyncAt = Date.now();
    void runSync();
  }

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisible);
  };
}