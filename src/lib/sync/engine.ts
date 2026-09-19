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

function stripSyncStatus<T extends { sync_status: SyncStatus }>(
  row: T,
): Omit<T, "sync_status"> {
  const { sync_status, ...rest } = row;
  void sync_status; // Pulled out of the object only to discard it.
  return rest;
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
    if (local.sync_status === "pending") continue;
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
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true });
    if (since) query = query.gt("updated_at", since);
    const { data, error } = await query;
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

  await db.sync_state.put({
    id: "default",
    last_pulled_at: new Date().toISOString(),
    last_pushed_at: state?.last_pushed_at ?? null,
  });
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

  if (ownedBooks.length) {
    const { error } = await supabase.from("books").upsert(ownedBooks);
    if (error) throw error;
    await Promise.all(
      ownedBooks.map((row) =>
        db.books.update(row.id, { sync_status: "synced" }),
      ),
    );
  }

  if (ownedAccounts.length) {
    const { error } = await supabase.from("accounts").upsert(ownedAccounts);
    if (error) throw error;
    await Promise.all(
      ownedAccounts.map((row) =>
        db.accounts.update(row.id, { sync_status: "synced" }),
      ),
    );
  }

  if (ownedCategories.length) {
    const { error } = await supabase.from("categories").upsert(ownedCategories);
    if (error) throw error;
    await Promise.all(
      ownedCategories.map((row) =>
        db.categories.update(row.id, { sync_status: "synced" }),
      ),
    );
  }

  if (ownedTransactions.length) {
    const { error } = await supabase
      .from("transactions")
      .upsert(ownedTransactions);
    if (error) throw error;
    await Promise.all(
      ownedTransactions.map((row) =>
        db.transactions.update(row.id, { sync_status: "synced" }),
      ),
    );
  }

  if (ownedBudgets.length) {
    const { error } = await supabase.from("budgets").upsert(ownedBudgets);
    if (error) throw error;
    await Promise.all(
      ownedBudgets.map((row) =>
        db.budgets.update(row.id, { sync_status: "synced" }),
      ),
    );
  }

  if (ownedTemplates.length) {
    const { error } = await supabase.from("templates").upsert(ownedTemplates);
    if (error) throw error;
    await Promise.all(
      ownedTemplates.map((row) =>
        db.templates.update(row.id, { sync_status: "synced" }),
      ),
    );
  }

  if (ownedHoldings.length) {
    const { error } = await supabase.from("holdings").upsert(ownedHoldings);
    if (error) throw error;
    await Promise.all(
      ownedHoldings.map((row) =>
        db.holdings.update(row.id, { sync_status: "synced" }),
      ),
    );
  }

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
    await pullAll(user.id);
    await pushPending(user.id);
    setStatus("synced");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "同步失敗，請稍後再試";
    setStatus("error", message);
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