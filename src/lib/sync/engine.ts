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

/** Keep one book per currency+name; re-point children so push does not fork ledgers. */
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
      // Prefer the cloud-synced twin so local random UUIDs do not stay active.
      if (b.synced !== a.synced) return b.synced - a.synced;
      if (b.txCount !== a.txCount) return b.txCount - a.txCount;
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

async function retireTransfersLocally() {
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
}

/** Remove invented/demo local rows that cloud cleanup cannot match by id. */
async function purgeInventedLocalData() {
  const stamp = new Date().toISOString();
  const junk = await db.transactions
    .filter((row) => {
      if (row.deleted_at) return false;
      if (row.note.includes("示範")) return true;
      // No real August ledger was provided — wipe any Aug rows still sitting locally.
      if (row.date >= "2026-08-01" && row.date < "2026-09-01") return true;
      // Aug/Sep income must stay 0 until the user provides real income.
      if (
        row.type === "income" &&
        row.date >= "2026-08-01" &&
        row.date < "2026-10-01"
      ) {
        return true;
      }
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
}

async function mergeRemoteBooks(remoteRows: CloudBook[]) {
  for (const remote of remoteRows) {
    const local = await db.books.get(remote.id);
    if (!local) {
      await db.books.put({ ...remote, sync_status: "synced" });
      continue;
    }
    if (local.sync_status === "pending") continue;
    if (remote.updated_at >= local.updated_at) {
      await db.books.put({ ...remote, sync_status: "synced" });
    }
  }
}

async function mergeRemoteAccounts(remoteRows: CloudAccount[]) {
  for (const remote of remoteRows) {
    // Rows created before migration 004 come back without opening_balance.
    const normalised = {
      ...remote,
      opening_balance: Number(remote.opening_balance ?? 0),
    };
    const local = await db.accounts.get(remote.id);
    if (!local) {
      await db.accounts.put({ ...normalised, sync_status: "synced" });
      continue;
    }
    if (local.sync_status === "pending") continue;
    if (remote.updated_at >= local.updated_at) {
      await db.accounts.put({ ...normalised, sync_status: "synced" });
    }
  }
}

async function mergeRemoteCategories(remoteRows: CloudCategory[]) {
  for (const remote of remoteRows) {
    const withColor = {
      ...remote,
      color: remote.color || "#0f7a5f",
    };
    const local = await db.categories.get(remote.id);
    if (!local) {
      await db.categories.put({ ...withColor, sync_status: "synced" });
      continue;
    }
    if (local.sync_status === "pending") continue;
    if (remote.updated_at >= local.updated_at) {
      await db.categories.put({ ...withColor, sync_status: "synced" });
    }
  }
}

async function mergeRemoteTransactions(remoteRows: CloudTransaction[]) {
  for (const remote of remoteRows) {
    const local = await db.transactions.get(remote.id);
    if (!local) {
      await db.transactions.put({
        ...remote,
        amount: Number(remote.amount),
        sync_status: "synced",
      });
      continue;
    }
    // Cloud wins when newer (including soft-deletes). Pending local must not
    // block cleanup of invented/demo rows already removed remotely.
    if (remote.updated_at >= local.updated_at) {
      await db.transactions.put({
        ...remote,
        amount: Number(remote.amount),
        sync_status: "synced",
      });
    }
  }
}

async function mergeRemoteBudgets(remoteRows: CloudBudget[]) {
  for (const remote of remoteRows) {
    const local = await db.budgets.get(remote.id);
    if (!local) {
      await db.budgets.put({
        ...remote,
        amount: Number(remote.amount),
        sync_status: "synced",
      });
      continue;
    }
    if (local.sync_status === "pending") continue;
    if (remote.updated_at >= local.updated_at) {
      await db.budgets.put({
        ...remote,
        amount: Number(remote.amount),
        sync_status: "synced",
      });
    }
  }
}

async function mergeRemoteTemplates(remoteRows: CloudTemplate[]) {
  for (const remote of remoteRows) {
    const normalised = {
      ...remote,
      amount: Number(remote.amount),
    };
    const local = await db.templates.get(remote.id);
    if (!local) {
      await db.templates.put({ ...normalised, sync_status: "synced" });
      continue;
    }
    if (local.sync_status === "pending") continue;
    if (remote.updated_at >= local.updated_at) {
      await db.templates.put({ ...normalised, sync_status: "synced" });
    }
  }
}

async function mergeRemoteHoldings(remoteRows: CloudHolding[]) {
  for (const remote of remoteRows) {
    const normalised = {
      ...remote,
      amount: Number(remote.amount),
      annual_rate: Number(remote.annual_rate),
    };
    const local = await db.holdings.get(remote.id);
    if (!local) {
      await db.holdings.put({ ...normalised, sync_status: "synced" });
      continue;
    }
    if (local.sync_status === "pending") continue;
    if (remote.updated_at >= local.updated_at) {
      await db.holdings.put({ ...normalised, sync_status: "synced" });
    }
  }
}

async function pullAll(userId: string) {
  const supabase = createClient();
  const state = await db.sync_state.get("default");
  const since = state?.last_pulled_at;

  {
    let query = supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true });
    if (since) query = query.gt("updated_at", since);
    const { data, error } = await query;
    if (error) throw error;
    await mergeRemoteBooks((data ?? []) as CloudBook[]);
  }

  {
    let query = supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true });
    if (since) query = query.gt("updated_at", since);
    const { data, error } = await query;
    if (error) throw error;
    await mergeRemoteAccounts((data ?? []) as CloudAccount[]);
  }

  {
    let query = supabase
      .from("categories")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true });
    if (since) query = query.gt("updated_at", since);
    const { data, error } = await query;
    if (error) throw error;
    await mergeRemoteCategories((data ?? []) as CloudCategory[]);
  }

  {
    // Always full-pull transactions so tombstones and Sep imports are not missed
    // when last_pulled_at advanced past a failed/partial sync.
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true });
    if (error) throw error;
    await mergeRemoteTransactions((data ?? []) as CloudTransaction[]);
  }

  {
    let query = supabase
      .from("budgets")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true });
    if (since) query = query.gt("updated_at", since);
    const { data, error } = await query;
    if (error) throw error;
    await mergeRemoteBudgets((data ?? []) as CloudBudget[]);
  }

  {
    let query = supabase
      .from("templates")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true });
    if (since) query = query.gt("updated_at", since);
    const { data, error } = await query;
    if (error) throw error;
    await mergeRemoteTemplates((data ?? []) as CloudTemplate[]);
  }

  {
    let query = supabase
      .from("holdings")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true });
    if (since) query = query.gt("updated_at", since);
    const { data, error } = await query;
    if (error) throw error;
    await mergeRemoteHoldings((data ?? []) as CloudHolding[]);
  }

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

  const ownedBooks = books
    .filter((row) => row.user_id === userId)
    .map(stripSyncStatus);
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

  async function upsertTable(
    table: string,
    rows: Record<string, unknown>[],
    markSynced: (id: string) => Promise<unknown>,
  ) {
    if (!rows.length) return;
    const { error } = await supabase.from(table).upsert(rows);
    if (error) throw Object.assign(error, { __table: table });
    await Promise.all(rows.map((row) => markSynced(String(row.id))));
  }

  await upsertTable("books", ownedBooks as Record<string, unknown>[], (id) =>
    db.books.update(id, { sync_status: "synced" }),
  );
  await upsertTable(
    "accounts",
    ownedAccounts as Record<string, unknown>[],
    (id) => db.accounts.update(id, { sync_status: "synced" }),
  );
  await upsertTable(
    "categories",
    ownedCategories as Record<string, unknown>[],
    (id) => db.categories.update(id, { sync_status: "synced" }),
  );
  await upsertTable(
    "transactions",
    ownedTransactions as Record<string, unknown>[],
    (id) => db.transactions.update(id, { sync_status: "synced" }),
  );
  await upsertTable(
    "budgets",
    ownedBudgets as Record<string, unknown>[],
    (id) => db.budgets.update(id, { sync_status: "synced" }),
  );
  await upsertTable(
    "templates",
    ownedTemplates as Record<string, unknown>[],
    (id) => db.templates.update(id, { sync_status: "synced" }),
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
    (id) => db.holdings.update(id, { sync_status: "synced" }),
  );

  const state = await db.sync_state.get("default");
  await db.sync_state.put({
    id: "default",
    last_pulled_at: state?.last_pulled_at ?? null,
    last_pushed_at: new Date().toISOString(),
  });
}

export async function runSync(): Promise<void> {
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

  syncing = true;
  setStatus("syncing");

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw userError;

    if (!user) {
      setStatus("local", "未登入，僅本機");
      return;
    }

    await claimLocalRowsForUser(user.id);
    const pulledAt = await pullAll(user.id);
    await collapseDuplicateBooks();
    await retireTransfersLocally();
    await purgeInventedLocalData();
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

export function startSyncListeners() {
  if (typeof window === "undefined") return () => undefined;

  const onOnline = () => {
    void runSync();
  };
  const onOffline = () => setStatus("offline");
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      void runSync();
    }
  };

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);

  if (!navigator.onLine) {
    setStatus("offline");
  } else {
    void runSync();
  }

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisible);
  };
}