import Dexie from "dexie";
import { getClientId } from "@/lib/client-id";
import { db } from "@/lib/db/schema";
import { monthlyInterest, yearlyInterest } from "@/lib/interest";
import type {
  Account,
  AccountBalance,
  Book,
  BookCurrency,
  Budget,
  Category,
  CategoryBreakdownItem,
  CategoryKind,
  DailyTrendPoint,
  DayBucket,
  Holding,
  HoldingKind,
  InterestCompounding,
  PeriodSummary,
  SummaryComparison,
  Template,
  Transaction,
  TransactionType,
} from "@/lib/types";

function nowIso() {
  return new Date().toISOString();
}

/** Local calendar date as YYYY-MM-DD (never UTC-shifted). */
function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function baseMeta(userId: string | null = null) {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    updated_at: nowIso(),
    deleted_at: null as string | null,
    client_id: getClientId(),
    sync_status: "pending" as const,
  };
}

function touchMeta() {
  return {
    updated_at: nowIso(),
    client_id: getClientId(),
    sync_status: "pending" as const,
  };
}

/** Whole-book slice of the [book_id+date] index, ordered by date ascending. */
function bookTransactions(bookId: string) {
  return db.transactions
    .where("[book_id+date]")
    .between([bookId, Dexie.minKey], [bookId, Dexie.maxKey]);
}

function monthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  return { start, end };
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function uniqueByKey<T>(rows: T[], keyOf: (row: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = keyOf(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function listBooks(): Promise<Book[]> {
  const rows = await db.books.orderBy("sort_order").toArray();
  return uniqueByKey(
    uniqueById(rows.filter((row) => !row.deleted_at)),
    (row) => `${row.currency}:${row.name.trim()}`,
  );
}

export async function createBook(input: {
  name: string;
  currency: BookCurrency;
}): Promise<Book> {
  const maxSort = await db.books.count();
  const book: Book = {
    ...baseMeta(),
    name: input.name.trim(),
    currency: input.currency,
    sort_order: maxSort,
  };
  await db.books.add(book);
  return book;
}

export async function listAccounts(bookId: string): Promise<Account[]> {
  const rows = await db.accounts.where("book_id").equals(bookId).sortBy("sort_order");
  return uniqueByKey(
    rows.filter((row) => !row.deleted_at),
    (row) => `${row.type}:${row.name.trim()}`,
  );
}

export async function listCategories(
  bookId: string,
  kind?: CategoryKind,
): Promise<Category[]> {
  const collection = kind
    ? db.categories.where("[book_id+kind]").equals([bookId, kind])
    : db.categories
        .where("[book_id+kind]")
        .between([bookId, Dexie.minKey], [bookId, Dexie.maxKey]);
  const rows = await collection.filter((row) => !row.deleted_at).sortBy("sort_order");
  return uniqueByKey(rows, (row) => `${row.kind}:${row.name.trim()}`);
}

export async function listTransactionsForMonth(
  bookId: string,
  year: number,
  month: number,
): Promise<Transaction[]> {
  const { start, end } = monthRange(year, month);

  const rows = await db.transactions
    .where("[book_id+date]")
    .between([bookId, start], [bookId, end], true, false)
    .filter((row) => !row.deleted_at && row.type !== "transfer")
    .reverse()
    .toArray();

  // The index already delivers date-descending; sorting only breaks same-day ties.
  return rows.sort((a, b) => {
    if (a.date === b.date) {
      return b.updated_at.localeCompare(a.updated_at);
    }
    return b.date.localeCompare(a.date);
  });
}

export async function listTransactionsForYear(
  bookId: string,
  year: number,
): Promise<Transaction[]> {
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;
  const rows = await db.transactions
    .where("[book_id+date]")
    .between([bookId, start], [bookId, end], true, false)
    .filter((row) => !row.deleted_at && row.type !== "transfer")
    .reverse()
    .toArray();
  return rows;
}

export async function listTransactionsForDate(
  bookId: string,
  date: string,
): Promise<Transaction[]> {
  const rows = await db.transactions
    .where("[book_id+date]")
    .equals([bookId, date])
    .filter((row) => !row.deleted_at && row.type !== "transfer")
    .toArray();
  return rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function searchTransactions(
  bookId: string,
  query: string,
): Promise<Transaction[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const categories = await listCategories(bookId);
  const categoryMap = new Map(
    categories.map((category) => [category.id, category.name.toLowerCase()]),
  );

  // Walking the index in reverse yields newest-first, so `limit` can stop early
  // instead of loading and sorting the whole book.
  return db.transactions
    .where("[book_id+date]")
    .between([bookId, Dexie.minKey], [bookId, Dexie.maxKey])
    .reverse()
    .filter((row) => {
      if (row.deleted_at) return false;
      if (row.type === "transfer") return false;
      const note = row.note.toLowerCase();
      const cat = row.category_id
        ? (categoryMap.get(row.category_id) ?? "")
        : "";
      return (
        note.includes(q) ||
        cat.includes(q) ||
        String(row.amount).includes(q) ||
        row.date.includes(q)
      );
    })
    .limit(200)
    .toArray();
}

export async function createAccount(
  bookId: string,
  input: {
    name: string;
    type: Account["type"];
    currency?: string;
    opening_balance?: number;
  },
): Promise<Account> {
  const maxSort = await db.accounts.where("book_id").equals(bookId).count();
  const book = await db.books.get(bookId);
  const account: Account = {
    ...baseMeta(),
    book_id: bookId,
    name: input.name.trim(),
    type: input.type,
    currency: input.currency ?? book?.currency ?? "TWD",
    sort_order: maxSort,
    opening_balance: input.opening_balance ?? 0,
  };
  await db.accounts.add(account);
  return account;
}

export async function updateAccount(
  id: string,
  patch: Partial<
    Pick<
      Account,
      "name" | "type" | "currency" | "sort_order" | "opening_balance"
    >
  >,
): Promise<void> {
  const existing = await db.accounts.get(id);
  if (!existing || existing.deleted_at) return;
  await db.accounts.update(id, {
    ...patch,
    ...touchMeta(),
  });
}

export async function softDeleteAccount(id: string): Promise<void> {
  const existing = await db.accounts.get(id);
  if (!existing || existing.deleted_at) return;
  await db.accounts.update(id, {
    deleted_at: nowIso(),
    updated_at: nowIso(),
    client_id: getClientId(),
    sync_status: "pending",
  });
}

export async function createCategory(
  bookId: string,
  input: {
    name: string;
    kind: CategoryKind;
    icon?: string;
    color?: string;
  },
): Promise<Category> {
  const sameKind = await db.categories
    .where("book_id")
    .equals(bookId)
    .filter((row) => row.kind === input.kind && !row.deleted_at)
    .count();
  const category: Category = {
    ...baseMeta(),
    book_id: bookId,
    name: input.name.trim(),
    kind: input.kind,
    icon: input.icon ?? "dots",
    color: input.color ?? "#0f7a5f",
    sort_order: sameKind,
  };
  await db.categories.add(category);
  return category;
}

export async function updateCategory(
  id: string,
  patch: Partial<
    Pick<Category, "name" | "kind" | "icon" | "color" | "sort_order">
  >,
): Promise<void> {
  const existing = await db.categories.get(id);
  if (!existing || existing.deleted_at) return;
  await db.categories.update(id, {
    ...patch,
    updated_at: nowIso(),
    client_id: getClientId(),
    sync_status: "pending",
  });
}

export async function softDeleteCategory(id: string): Promise<void> {
  const existing = await db.categories.get(id);
  if (!existing || existing.deleted_at) return;
  await db.categories.update(id, {
    deleted_at: nowIso(),
    updated_at: nowIso(),
    client_id: getClientId(),
    sync_status: "pending",
  });
}

export async function createTransaction(
  bookId: string,
  input: {
    type: TransactionType;
    amount: number;
    date: string;
    note?: string;
    account_id: string;
    category_id?: string | null;
    transfer_account_id?: string | null;
  },
): Promise<Transaction> {
  const tx: Transaction = {
    ...baseMeta(),
    book_id: bookId,
    type: input.type,
    amount: Math.abs(input.amount),
    date: input.date,
    note: input.note?.trim() ?? "",
    account_id: input.account_id,
    category_id: input.category_id ?? null,
    transfer_account_id: input.transfer_account_id ?? null,
  };
  await db.transactions.add(tx);
  return tx;
}

export async function updateTransaction(
  id: string,
  patch: Partial<
    Pick<
      Transaction,
      | "type"
      | "amount"
      | "date"
      | "note"
      | "account_id"
      | "category_id"
      | "transfer_account_id"
    >
  >,
): Promise<void> {
  const existing = await db.transactions.get(id);
  if (!existing || existing.deleted_at) return;
  await db.transactions.update(id, {
    ...patch,
    amount:
      patch.amount !== undefined ? Math.abs(patch.amount) : existing.amount,
    updated_at: nowIso(),
    client_id: getClientId(),
    sync_status: "pending",
  });
}

export async function softDeleteTransaction(id: string): Promise<void> {
  const existing = await db.transactions.get(id);
  if (!existing || existing.deleted_at) return;
  await db.transactions.update(id, {
    deleted_at: nowIso(),
    updated_at: nowIso(),
    client_id: getClientId(),
    sync_status: "pending",
  });
}

export async function getTransaction(
  id: string,
): Promise<Transaction | undefined> {
  const row = await db.transactions.get(id);
  if (!row || row.deleted_at) return undefined;
  return row;
}

export async function restoreTransaction(id: string): Promise<void> {
  const existing = await db.transactions.get(id);
  if (!existing) return;
  await db.transactions.update(id, {
    deleted_at: null,
    ...touchMeta(),
  });
}

export async function duplicateTransaction(
  id: string,
  date = todayIso(),
): Promise<Transaction | undefined> {
  const existing = await getTransaction(id);
  if (!existing) return undefined;
  return createTransaction(existing.book_id, {
    type: existing.type,
    amount: existing.amount,
    date,
    note: existing.note,
    account_id: existing.account_id,
    category_id: existing.category_id,
    transfer_account_id: existing.transfer_account_id,
  });
}

export async function listTransactionsForAccount(
  bookId: string,
  accountId: string,
): Promise<Transaction[]> {
  const rows = await bookTransactions(bookId)
    .filter(
      (row) =>
        !row.deleted_at &&
        (row.account_id === accountId || row.transfer_account_id === accountId),
    )
    .reverse()
    .toArray();
  return rows
    .sort((a, b) =>
      a.date === b.date
        ? b.updated_at.localeCompare(a.updated_at)
        : b.date.localeCompare(a.date),
    )
    .slice(0, 300);
}

export async function listBudgets(
  bookId: string,
  year: number,
  month: number,
): Promise<Budget[]> {
  return db.budgets
    .where("[book_id+year+month]")
    .equals([bookId, year, month])
    .filter((row) => !row.deleted_at)
    .toArray();
}

export async function upsertBudget(
  bookId: string,
  input: {
    year: number;
    month: number;
    category_id: string | null;
    amount: number;
  },
): Promise<Budget> {
  const existing = await db.budgets
    .where("[book_id+year+month]")
    .equals([bookId, input.year, input.month])
    .filter(
      (row) => !row.deleted_at && row.category_id === input.category_id,
    )
    .first();

  if (existing) {
    await db.budgets.update(existing.id, {
      amount: Math.abs(input.amount),
      ...touchMeta(),
    });
    return { ...existing, amount: Math.abs(input.amount) };
  }

  const budget: Budget = {
    ...baseMeta(),
    book_id: bookId,
    year: input.year,
    month: input.month,
    category_id: input.category_id,
    amount: Math.abs(input.amount),
  };
  await db.budgets.add(budget);
  return budget;
}

export async function softDeleteBudget(id: string): Promise<void> {
  const existing = await db.budgets.get(id);
  if (!existing || existing.deleted_at) return;
  await db.budgets.update(id, {
    deleted_at: nowIso(),
    updated_at: nowIso(),
    client_id: getClientId(),
    sync_status: "pending",
  });
}

export async function listTemplates(bookId: string): Promise<Template[]> {
  return db.templates
    .where("[book_id+sort_order]")
    .between([bookId, Dexie.minKey], [bookId, Dexie.maxKey])
    .filter((row) => !row.deleted_at)
    .toArray();
}

export async function createTemplate(
  bookId: string,
  input: {
    name: string;
    type: TransactionType;
    amount: number;
    note?: string;
    account_id: string;
    category_id?: string | null;
    transfer_account_id?: string | null;
    sort_order?: number;
  },
): Promise<Template> {
  const maxSort = await db.templates.where("book_id").equals(bookId).count();
  const template: Template = {
    ...baseMeta(),
    book_id: bookId,
    name: input.name.trim(),
    type: input.type,
    amount: Math.abs(input.amount),
    note: input.note?.trim() ?? "",
    account_id: input.account_id,
    category_id: input.category_id ?? null,
    transfer_account_id: input.transfer_account_id ?? null,
    sort_order: input.sort_order ?? maxSort,
  };
  await db.templates.add(template);
  return template;
}

export async function updateTemplate(
  id: string,
  patch: Partial<
    Pick<
      Template,
      | "name"
      | "type"
      | "amount"
      | "note"
      | "account_id"
      | "category_id"
      | "transfer_account_id"
      | "sort_order"
    >
  >,
): Promise<void> {
  const existing = await db.templates.get(id);
  if (!existing || existing.deleted_at) return;
  await db.templates.update(id, {
    ...patch,
    amount:
      patch.amount !== undefined ? Math.abs(patch.amount) : existing.amount,
    ...touchMeta(),
  });
}

export async function softDeleteTemplate(id: string): Promise<void> {
  const existing = await db.templates.get(id);
  if (!existing || existing.deleted_at) return;
  await db.templates.update(id, {
    deleted_at: nowIso(),
    ...touchMeta(),
  });
}

/** One-tap reuse: turn a template into a real transaction (defaults to today). */
export async function applyTemplate(
  templateId: string,
  date?: string,
): Promise<Transaction> {
  const template = await db.templates.get(templateId);
  if (!template || template.deleted_at) {
    throw new Error("找不到這個範本");
  }
  return createTransaction(template.book_id, {
    type: template.type,
    amount: template.amount,
    date: date ?? todayIso(),
    note: template.note,
    account_id: template.account_id,
    category_id: template.category_id,
    transfer_account_id: template.transfer_account_id,
  });
}

export async function createTemplateFromTransaction(
  transactionId: string,
  name: string,
): Promise<Template> {
  const tx = await db.transactions.get(transactionId);
  if (!tx || tx.deleted_at) {
    throw new Error("找不到這筆交易");
  }
  return createTemplate(tx.book_id, {
    name,
    type: tx.type,
    amount: tx.amount,
    note: tx.note,
    account_id: tx.account_id,
    category_id: tx.category_id,
    transfer_account_id: tx.transfer_account_id,
  });
}

export async function accountBalances(
  bookId: string,
): Promise<AccountBalance[]> {
  const [accounts, transactions] = await Promise.all([
    listAccounts(bookId),
    bookTransactions(bookId)
      .filter((row) => !row.deleted_at)
      .toArray(),
  ]);

  const deltas = new Map<string, number>();
  const add = (accountId: string | null, amount: number) => {
    if (!accountId) return;
    deltas.set(accountId, (deltas.get(accountId) ?? 0) + amount);
  };

  for (const tx of transactions) {
    if (tx.type === "income") {
      add(tx.account_id, tx.amount);
    } else if (tx.type === "expense") {
      add(tx.account_id, -tx.amount);
    } else {
      // Transfer: account_id is the source, transfer_account_id the destination.
      add(tx.account_id, -tx.amount);
      add(tx.transfer_account_id, tx.amount);
    }
  }

  return accounts.map((account) => ({
    account,
    balance: (account.opening_balance ?? 0) + (deltas.get(account.id) ?? 0),
  }));
}

export async function bookTotals(
  bookId: string,
): Promise<{ total: number; accounts: number; holdings: number }> {
  const [balances, holdings] = await Promise.all([
    accountBalances(bookId),
    listHoldings(bookId),
  ]);
  const accounts = balances.reduce((sum, item) => sum + item.balance, 0);
  const holdingSum = holdings.reduce((sum, item) => sum + item.amount, 0);
  return {
    accounts,
    holdings: holdingSum,
    total: accounts + holdingSum,
  };
}

export async function listHoldings(bookId: string): Promise<Holding[]> {
  const rows = await db.holdings.where("book_id").equals(bookId).sortBy("sort_order");
  return rows.filter((row) => !row.deleted_at);
}

export async function createHolding(
  bookId: string,
  input: {
    name: string;
    kind: HoldingKind;
    institution?: string;
    amount: number;
    annual_rate?: number;
    compounding?: InterestCompounding;
    start_date?: string;
    maturity_date?: string | null;
    note?: string;
    color?: string;
    icon?: string;
  },
): Promise<Holding> {
  const maxSort = await db.holdings.where("book_id").equals(bookId).count();
  const holding: Holding = {
    ...baseMeta(),
    book_id: bookId,
    name: input.name.trim(),
    kind: input.kind,
    institution: input.institution?.trim() ?? "",
    amount: Math.max(0, input.amount),
    annual_rate: Math.max(0, input.annual_rate ?? 0),
    compounding: input.compounding ?? (input.annual_rate ? "simple" : "none"),
    start_date: input.start_date ?? todayIso(),
    maturity_date: input.maturity_date ?? null,
    note: input.note?.trim() ?? "",
    color: input.color ?? "#0f7a5f",
    icon: input.icon ?? "wallet",
    sort_order: maxSort,
  };
  await db.holdings.add(holding);
  return holding;
}

export async function updateHolding(
  id: string,
  patch: Partial<
    Pick<
      Holding,
      | "name"
      | "kind"
      | "institution"
      | "amount"
      | "annual_rate"
      | "compounding"
      | "start_date"
      | "maturity_date"
      | "note"
      | "color"
      | "icon"
      | "sort_order"
    >
  >,
): Promise<void> {
  const existing = await db.holdings.get(id);
  if (!existing || existing.deleted_at) return;
  const next: Partial<Holding> = { ...patch, ...touchMeta() };
  if (patch.amount !== undefined) next.amount = Math.max(0, patch.amount);
  if (patch.annual_rate !== undefined) {
    next.annual_rate = Math.max(0, patch.annual_rate);
  }
  await db.holdings.update(id, next);
}

export async function softDeleteHolding(id: string): Promise<void> {
  const existing = await db.holdings.get(id);
  if (!existing || existing.deleted_at) return;
  await db.holdings.update(id, {
    deleted_at: nowIso(),
    updated_at: nowIso(),
    client_id: getClientId(),
    sync_status: "pending",
  });
}

export async function restoreHolding(id: string): Promise<void> {
  const existing = await db.holdings.get(id);
  if (!existing) return;
  await db.holdings.update(id, {
    deleted_at: null,
    ...touchMeta(),
  });
}

/**
 * Books an income transaction for estimated interest. Principal on the
 * holding is unchanged — this is a ledger entry, not a balance rewrite.
 */
export async function recordHoldingInterest(
  holdingId: string,
  period: "month" | "year",
): Promise<Transaction> {
  const holding = await db.holdings.get(holdingId);
  if (!holding || holding.deleted_at) {
    throw new Error("找不到這筆存款");
  }
  const amount =
    period === "year"
      ? yearlyInterest(holding.amount, holding.annual_rate, holding.compounding)
      : monthlyInterest(holding.amount, holding.annual_rate);
  if (amount <= 0) {
    throw new Error("這筆存款沒有可記入的利息");
  }

  const accounts = await listAccounts(holding.book_id);
  const account =
    accounts.find((row) => row.type === "bank") ?? accounts[0];
  if (!account) {
    throw new Error("請先新增一個帳戶再記入利息");
  }

  const categories = await listCategories(holding.book_id, "income");
  const preferred =
    holding.kind === "fund" || holding.kind === "stock" ? "投資收益" : "定存利息";
  const category =
    categories.find((row) => row.name === preferred) ??
    categories.find(
      (row) => row.name.includes("利息") || row.name.includes("投資"),
    ) ??
    categories[0] ??
    null;

  const periodLabel = period === "year" ? "年利息" : "月利息";
  return createTransaction(holding.book_id, {
    type: "income",
    amount,
    date: todayIso(),
    note: `${holding.name} ${periodLabel}`,
    account_id: account.id,
    category_id: category?.id ?? null,
  });
}

export async function claimLocalRowsForUser(userId: string): Promise<void> {
  const stamp = nowIso();
  await db.transaction(
    "rw",
    [db.books, db.accounts, db.categories, db.transactions, db.budgets, db.templates, db.holdings],
    async () => {
      const tables = [
        db.books,
        db.accounts,
        db.categories,
        db.transactions,
        db.budgets,
        db.templates,
        db.holdings,
      ] as const;
      for (const table of tables) {
        const orphans = await table.filter((row) => !row.user_id).toArray();
        for (const row of orphans) {
          await table.update(row.id, {
            user_id: userId,
            updated_at: stamp,
            client_id: getClientId(),
            sync_status: "pending",
          });
        }
      }
    },
  );
}

export function monthSummary(transactions: Transaction[]): PeriodSummary {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === "income") income += tx.amount;
    if (tx.type === "expense") expense += tx.amount;
  }
  return {
    income,
    expense,
    net: income - expense,
  };
}

export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  type: "income" | "expense" = "expense",
): CategoryBreakdownItem[] {
  const map = new Map<string | null, number>();
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const key = tx.category_id;
    map.set(key, (map.get(key) ?? 0) + tx.amount);
  }

  const total = [...map.values()].reduce((sum, value) => sum + value, 0);
  const categoryMap = Object.fromEntries(
    categories.map((category) => [category.id, category]),
  );

  return [...map.entries()]
    .map(([categoryId, amount]) => {
      const category = categoryId ? categoryMap[categoryId] : undefined;
      return {
        categoryId,
        name: category?.name ?? "未分類",
        color: category?.color ?? "#7f8c8d",
        icon: category?.icon ?? "dots",
        amount,
        percent: total > 0 ? (amount / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function groupTransactionsByDay(
  transactions: Transaction[],
): DayBucket[] {
  const map = new Map<string, DayBucket>();
  for (const tx of transactions) {
    const bucket = map.get(tx.date) ?? {
      date: tx.date,
      income: 0,
      expense: 0,
      transactions: [],
    };
    if (tx.type === "income") bucket.income += tx.amount;
    if (tx.type === "expense") bucket.expense += tx.amount;
    bucket.transactions.push(tx);
    map.set(tx.date, bucket);
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function monthlyTotalsForYear(transactions: Transaction[]) {
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    income: 0,
    expense: 0,
  }));
  for (const tx of transactions) {
    const month = Number(tx.date.slice(5, 7));
    if (!month || month < 1 || month > 12) continue;
    if (tx.type === "income") months[month - 1].income += tx.amount;
    if (tx.type === "expense") months[month - 1].expense += tx.amount;
  }
  return months;
}

export function dailyAverageExpense(
  transactions: Transaction[],
  daysInPeriod: number,
): number {
  if (daysInPeriod <= 0) return 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === "expense") expense += tx.amount;
  }
  return expense / daysInPeriod;
}

export function compareSummaries(
  current: PeriodSummary,
  previous: PeriodSummary,
): SummaryComparison {
  const incomeDelta = current.income - previous.income;
  const expenseDelta = current.expense - previous.expense;
  return {
    incomeDelta,
    expenseDelta,
    incomePercent:
      previous.income === 0 ? 0 : (incomeDelta / previous.income) * 100,
    expensePercent:
      previous.expense === 0 ? 0 : (expenseDelta / previous.expense) * 100,
  };
}

export function dailyTrend(transactions: Transaction[]): DailyTrendPoint[] {
  const map = new Map<string, DailyTrendPoint>();
  for (const tx of transactions) {
    const point = map.get(tx.date) ?? {
      date: tx.date,
      income: 0,
      expense: 0,
    };
    if (tx.type === "income") point.income += tx.amount;
    if (tx.type === "expense") point.expense += tx.amount;
    map.set(tx.date, point);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function topCategories(
  transactions: Transaction[],
  categories: Category[],
  type: "income" | "expense" = "expense",
  limit = 5,
): CategoryBreakdownItem[] {
  if (limit <= 0) return [];
  return categoryBreakdown(transactions, categories, type).slice(0, limit);
}

export function transactionsToCsv(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
): string {
  const accountMap = Object.fromEntries(
    accounts.map((account) => [account.id, account.name]),
  );
  const categoryMap = Object.fromEntries(
    categories.map((category) => [category.id, category.name]),
  );
  const header = ["date", "type", "amount", "category", "account", "note"];
  const lines = transactions.map((tx) =>
    [
      tx.date,
      tx.type,
      String(tx.amount),
      tx.category_id ? (categoryMap[tx.category_id] ?? "") : "",
      accountMap[tx.account_id] ?? "",
      `"${tx.note.replaceAll('"', '""')}"`,
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}