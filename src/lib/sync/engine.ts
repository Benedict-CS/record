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
  for (const remote of remoteRows) {
    const local = await db.books.get(remote.id);
    if (!local) {
      await db.books.put({ ...remote, sync_status: "synced" });
      continue;
    }
    // Cloud wins when newer (incl. resurrect). Pending local must not block
    // adopting the KEEP book after a collapse tombstone race.
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
    if (
      local.sync_status === "pending" &&
      local.deleted_at &&
      !remote.deleted_at &&
      local.updated_at >= remote.updated_at
    ) {
      continue;
    }
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
    // Pending local soft-delete must not be undone by an older live remote row.
    if (
      local.sync_status === "pending" &&
      local.deleted_at &&
      !remote.deleted_at &&
      local.updated_at >= remote.updated_at
    ) {
      continue;
    }
    if (remote.updated_at >= local.updated_at) {
      await db.categories.put({ ...withColor, sync_status: "synced" });
    }
  }
}

async function mergeRemoteTransactions(remoteRows: CloudTransaction[]) {
  for (const remote of remoteRows) {
    const normalised: CloudTransaction = {
      ...remote,
      amount: Number(remote.amount),
      hold_status: (remote.hold_status ?? null) as CloudTransaction["hold_status"],
      release_transaction_id: remote.release_transaction_id ?? null,
    };
    const local = await db.transactions.get(remote.id);
    if (!local) {
      await db.transactions.put({
        ...normalised,
        sync_status: "synced",
      });
      continue;
    }
    // Cloud wins when newer (including soft-deletes). Pending local must not
    // block cleanup of invented/demo rows already removed remotely.
    if (remote.updated_at >= local.updated_at) {
      await db.transactions.put({
        ...normalised,
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
    // Full-pull books so KEEP resurrects even if last_pulled_at skipped it.
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true });
    if (error) throw error;
    await mergeRemoteBooks((data ?? []) as CloudBook[]);
  }

  {
    // Full-pull accounts so TWD account lists cannot vanish after twin collapse.
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true });
    if (error) throw error;
    await mergeRemoteAccounts((data ?? []) as CloudAccount[]);
  }

  {
    // Full-pull categories with books/accounts so new tags (運動/機車) land.
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true });
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
  setStatus("syncing", "正在載入雲端資料…");

  try {
    // Seed first so sync never races an empty twin create mid-pull.
    const { ensureSeedData } = await import("@/lib/db/seed");
    await ensureSeedData();

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
    await repairDeadAccountRefs();
    await preferCanonicalActiveBook();
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