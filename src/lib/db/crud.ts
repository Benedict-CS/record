import Dexie from "dexie";
import {
  isPinnedLastCategory,
  sortCategories,
} from "@/lib/category-order";
import { getClientId } from "@/lib/client-id";
import { getOwnerId, sameOwner } from "@/lib/db/owner";
import {
  compareMonthTransactions,
  compareSameDayTransactions,
} from "@/lib/day-order";
import { db } from "@/lib/db/schema";
import { formatMoney } from "@/lib/format";
import {
  NO_HOLDING_LINK,
  holdingBalanceDeltas,
  holdingLinkNeedsLiveTarget,
  isSpendableBankHolding,
  nextHoldingBalances,
  nextHoldingSpend,
  storedHoldingSpend,
} from "@/lib/holding-spend";
import { monthlyInterest, yearlyInterest } from "@/lib/interest";
import {
  normalizeTransactionTag,
  tagSearchText,
  TREAT_TAG,
} from "@/lib/transaction-tag";
import { applyInvestMove, reverseInvestMove } from "@/lib/db/invest-move";
import { isOpenItem } from "@/lib/open-items";
import { expenseDisplayAmount } from "@/lib/reimbursement";
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
  HoldStatus,
  InterestCompounding,
  PeriodSummary,
  ReimbursementStatus,
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

function baseMeta() {
  return {
    id: crypto.randomUUID(),
    user_id: getOwnerId(),
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

function centsOf(amount: number) {
  return Math.round(amount * 100);
}

/**
 * Move 存款 balances to match a bank expense or income link.
 * Must run inside a read-write transaction that includes holdings and accounts.
 * Returns the holding id to store (null when this row should not touch a holding).
 */
async function commitHoldingSpend(input: {
  bookId: string;
  previous: Transaction | null;
  next: {
    type: string;
    amount: number;
    account_id: string;
    holding_id: string | null | undefined;
    deleted: boolean;
  };
}): Promise<string | null> {
  const account = input.next.deleted
    ? undefined
    : await db.accounts.get(input.next.account_id);
  const nextLink = nextHoldingSpend({
    type: input.next.type,
    amount: input.next.amount,
    holdingId: input.next.holding_id,
    accountType: account?.type ?? null,
    deleted: input.next.deleted,
  });
  const previousLink = input.previous
    ? storedHoldingSpend({
        type: input.previous.type,
        amount: input.previous.amount,
        holdingId: input.previous.holding_id,
        deleted: Boolean(input.previous.deleted_at),
      })
    : NO_HOLDING_LINK;

  if (holdingLinkNeedsLiveTarget(previousLink, nextLink) && nextLink.holdingId) {
    const holding = await db.holdings.get(nextLink.holdingId);
    const missing =
      !holding || holding.deleted_at || holding.book_id !== input.bookId;
    const crediting = nextLink.sign > 0;
    if (missing) {
      throw new Error(
        crediting ? "找不到要入帳的銀行存款" : "找不到要扣款的銀行存款",
      );
    }
    if (holding && !isSpendableBankHolding(holding.kind)) {
      throw new Error(
        crediting ? "只能入到活存或定存" : "只能從活存或定存扣款",
      );
    }
  }

  const deltas = holdingBalanceDeltas(previousLink, nextLink);
  if (!deltas.length) return nextLink.holdingId;

  const ids = [...new Set(deltas.map((row) => row.holdingId))];
  const rows = await db.holdings.bulkGet(ids);
  const currentCents: Record<string, number> = {};
  rows.forEach((row, index) => {
    if (!row || row.deleted_at || row.book_id !== input.bookId) return;
    currentCents[ids[index]] = centsOf(row.amount);
  });

  // A deleted holding cannot give money back or take a credit back.
  // Dropping that delta lets the ledger row still change.
  const applicable = deltas.filter((delta) => delta.holdingId in currentCents);
  const result = nextHoldingBalances(currentCents, applicable);
  if (result.missingId) {
    throw new Error(
      nextLink.sign > 0 ? "找不到要入帳的銀行存款" : "找不到要扣款的銀行存款",
    );
  }
  if (result.shortfallId) {
    const holding = rows.find((row) => row?.id === result.shortfallId);
    const name = holding?.name ?? "存款";
    throw new Error(
      `「${name}」餘額不足，目前 ${formatMoney(holding?.amount ?? 0)}`,
    );
  }

  const stamp = touchMeta();
  for (const [id, cents] of Object.entries(result.balances)) {
    if (currentCents[id] === cents) continue;
    await db.holdings.update(id, {
      amount: cents / 100,
      ...stamp,
    });
  }
  return nextLink.holdingId;
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
  const ownerId = getOwnerId();
  const rows = await db.books.orderBy("sort_order").toArray();
  const live = uniqueById(
    rows.filter(
      (row) => !row.deleted_at && sameOwner(row.user_id, ownerId),
    ),
  );

  // When duplicate currency+name books exist, keep the one with the most txs.
  const best = new Map<string, Book>();
  for (const book of live) {
    const key = `${book.currency}:${book.name.trim()}`;
    const current = best.get(key);
    if (!current) {
      best.set(key, book);
      continue;
    }
    const [a, b] = await Promise.all([
      db.transactions
        .where("book_id")
        .equals(current.id)
        .filter((row) => !row.deleted_at)
        .count(),
      db.transactions
        .where("book_id")
        .equals(book.id)
        .filter((row) => !row.deleted_at)
        .count(),
    ]);
    if (b > a) best.set(key, book);
  }
  return [...best.values()].sort((a, b) => a.sort_order - b.sort_order);
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
  return sortCategories(
    uniqueByKey(rows, (row) => `${row.kind}:${row.name.trim()}`),
  );
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

  const categories = await listCategories(bookId);
  const names = new Map(categories.map((row) => [row.id, row.name]));
  const nameOf = (categoryId: string | null) =>
    categoryId ? names.get(categoryId) : null;

  return rows.sort((a, b) => compareMonthTransactions(a, b, nameOf));
}

/** Latest calendar month that still has live transactions (for empty-home jump). */
export async function findLatestTransactionMonth(
  bookId: string,
): Promise<{ year: number; month: number } | null> {
  const rows = await db.transactions
    .where("book_id")
    .equals(bookId)
    .filter((row) => !row.deleted_at && row.type !== "transfer" && Boolean(row.date))
    .toArray();
  if (!rows.length) return null;
  let maxDate = rows[0].date;
  for (const row of rows) {
    if (row.date > maxDate) maxDate = row.date;
  }
  const [yearText, monthText] = maxDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return null;
  return { year, month };
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

  const categories = await listCategories(bookId);
  const names = new Map(categories.map((row) => [row.id, row.name]));
  const nameOf = (categoryId: string | null) =>
    categoryId ? names.get(categoryId) : null;

  return rows.sort((a, b) => compareSameDayTransactions(a, b, nameOf));
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
      const tag = tagSearchText(row.tag).toLowerCase();
      return (
        note.includes(q) ||
        cat.includes(q) ||
        tag.includes(q) ||
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
    .toArray();
  const pinned = sameKind.find((row) => isPinnedLastCategory(row));
  // Keep 其他支出 / 其他收入 at the end: insert before the pinned catch-all.
  const sort_order = pinned
    ? pinned.sort_order
    : sameKind.filter((row) => !isPinnedLastCategory(row)).length;
  const category: Category = {
    ...baseMeta(),
    book_id: bookId,
    name: input.name.trim(),
    kind: input.kind,
    icon: input.icon ?? "dots",
    color: input.color ?? "#0f7a5f",
    sort_order,
  };
  await db.categories.add(category);
  if (pinned) {
    await db.categories.update(pinned.id, {
      sort_order: sort_order + 1,
      updated_at: nowIso(),
      client_id: getClientId(),
      sync_status: "pending",
    });
  }
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
    hold_status?: HoldStatus | null;
    release_transaction_id?: string | null;
    reimbursable_amount?: number | null;
    reimbursement_status?: ReimbursementStatus | null;
    holding_id?: string | null;
    tag?: string | null;
    id?: string;
  },
): Promise<Transaction> {
  if (input.id) {
    const existing = await db.transactions.get(input.id);
    if (existing) return existing;
  }
  const isHold = input.type === "hold";
  const isExpense = input.type === "expense";
  const reimbursable =
    isExpense &&
    input.reimbursable_amount != null &&
    input.reimbursable_amount > 0
      ? input.reimbursable_amount
      : null;
  const tx: Transaction = {
    ...baseMeta(),
    ...(input.id ? { id: input.id } : {}),
    book_id: bookId,
    type: input.type,
    amount: Math.abs(input.amount),
    date: input.date,
    note: input.note?.trim() ?? "",
    account_id: input.account_id,
    category_id: input.category_id ?? null,
    transfer_account_id: input.transfer_account_id ?? null,
    hold_status: isHold ? (input.hold_status ?? "held") : null,
    release_transaction_id: isHold
      ? (input.release_transaction_id ?? null)
      : null,
    reimbursable_amount: reimbursable,
    reimbursement_status: reimbursable
      ? (input.reimbursement_status ?? "pending")
      : null,
    holding_id: null,
    tag: normalizeTransactionTag(input.type, input.tag),
    target_holding_id: null,
  };
  await db.transaction(
    "rw",
    db.transactions,
    db.holdings,
    db.accounts,
    async () => {
      tx.holding_id = await commitHoldingSpend({
        bookId,
        previous: null,
        next: {
          type: tx.type,
          amount: tx.amount,
          account_id: tx.account_id,
          holding_id: input.holding_id,
          deleted: false,
        },
      });
      await db.transactions.add(tx);
    },
  );
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
      | "hold_status"
      | "release_transaction_id"
      | "reimbursable_amount"
      | "reimbursement_status"
      | "holding_id"
      | "tag"
    >
  >,
): Promise<void> {
  await db.transaction(
    "rw",
    db.transactions,
    db.holdings,
    db.accounts,
    async () => {
      const existing = await db.transactions.get(id);
      if (!existing || existing.deleted_at) return;
      const nextType = patch.type ?? existing.type;
      const isHold = nextType === "hold";
      const isExpense = nextType === "expense";
      const nextAmount =
        patch.amount !== undefined ? Math.abs(patch.amount) : existing.amount;

      let reimbursable_amount: number | null = null;
      let reimbursement_status: Transaction["reimbursement_status"] = null;
      if (isExpense) {
        const raw =
          patch.reimbursable_amount !== undefined
            ? patch.reimbursable_amount
            : existing.reimbursable_amount;
        if (raw != null && raw > 0) {
          reimbursable_amount = raw;
          reimbursement_status =
            patch.reimbursement_status !== undefined
              ? patch.reimbursement_status
              : (existing.reimbursement_status ?? "pending");
        }
      }

      const holding_id = await commitHoldingSpend({
        bookId: existing.book_id,
        previous: existing,
        next: {
          type: nextType,
          amount: nextAmount,
          account_id: patch.account_id ?? existing.account_id,
          holding_id:
            patch.holding_id !== undefined
              ? patch.holding_id
              : existing.holding_id,
          deleted: false,
        },
      });

      await db.transactions.update(id, {
        ...patch,
        amount: nextAmount,
        hold_status: isHold
          ? (patch.hold_status ?? existing.hold_status ?? "held")
          : null,
        release_transaction_id: isHold
          ? (patch.release_transaction_id !== undefined
              ? patch.release_transaction_id
              : existing.release_transaction_id)
          : null,
        reimbursable_amount,
        reimbursement_status,
        holding_id,
        tag: normalizeTransactionTag(
          nextType,
          patch.tag !== undefined ? patch.tag : existing.tag,
        ),
        updated_at: nowIso(),
        client_id: getClientId(),
        sync_status: "pending",
      });
    },
  );
}

export async function softDeleteTransaction(id: string): Promise<void> {
  const existing = await db.transactions.get(id);
  if (!existing || existing.deleted_at) return;

  const stamp = nowIso();
  const tombstone = {
    deleted_at: stamp,
    updated_at: stamp,
    client_id: getClientId(),
    sync_status: "pending" as const,
  };

  await db.transaction(
    "rw",
    db.transactions,
    db.holdings,
    db.accounts,
    async () => {
    const row = await db.transactions.get(id);
    if (!row || row.deleted_at) return;

    await commitHoldingSpend({
      bookId: row.book_id,
      previous: row,
      next: {
        type: row.type,
        amount: row.amount,
        account_id: row.account_id,
        holding_id: row.holding_id,
        deleted: true,
      },
    });
    if (
      row.type === "invest" &&
      row.holding_id &&
      row.target_holding_id
    ) {
      await reverseInvestMove({
        bookId: row.book_id,
        sourceId: row.holding_id,
        targetId: row.target_holding_id,
        amount: row.amount,
      });
    }

    // Keep hold ↔ release income paired so account balances stay consistent.
    if (row.type === "hold" && row.release_transaction_id) {
      const income = await db.transactions.get(row.release_transaction_id);
      if (income && !income.deleted_at) {
        await db.transactions.update(income.id, tombstone);
      }
    } else if (row.type === "income") {
      const hold = await db.transactions
        .where("book_id")
        .equals(row.book_id)
        .filter(
          (tx) =>
            !tx.deleted_at &&
            tx.type === "hold" &&
            tx.release_transaction_id === row.id,
        )
        .first();
      if (hold) {
        await db.transactions.update(hold.id, tombstone);
      }
    }

    await db.transactions.update(row.id, tombstone);
  },
  );
}

export async function getTransaction(
  id: string,
): Promise<Transaction | undefined> {
  const row = await db.transactions.get(id);
  if (!row || row.deleted_at) return undefined;
  return row;
}

export async function restoreTransaction(id: string): Promise<void> {
  await db.transaction(
    "rw",
    db.transactions,
    db.holdings,
    db.accounts,
    async () => {
      const existing = await db.transactions.get(id);
      if (!existing) return;
      if (existing.deleted_at) {
        const account = await db.accounts.get(existing.account_id);
        await commitHoldingSpend({
          bookId: existing.book_id,
          previous: existing,
          next: {
            type: existing.type,
            amount: existing.amount,
            account_id: existing.account_id,
            holding_id:
              account?.type === "bank" ? existing.holding_id : null,
            deleted: false,
          },
        });
        if (
          existing.type === "invest" &&
          existing.holding_id &&
          existing.target_holding_id
        ) {
          await applyInvestMove({
            bookId: existing.book_id,
            sourceId: existing.holding_id,
            targetId: existing.target_holding_id,
            amount: existing.amount,
          });
        }
      }
      await db.transactions.update(id, {
        deleted_at: null,
        ...touchMeta(),
      });
    },
  );
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
    hold_status: existing.type === "hold" ? "held" : null,
    reimbursable_amount:
      existing.type === "expense" ? existing.reimbursable_amount : null,
    reimbursement_status:
      existing.type === "expense" && existing.reimbursable_amount
        ? "pending"
        : null,
    holding_id: existing.holding_id,
    tag: existing.tag,
  });
}

/**
 * Mark company reimbursement as received (e.g. with salary).
 * Does not create income — cash already left on the expense; salary covers it.
 */
export async function markReimbursementReceived(id: string): Promise<void> {
  const existing = await getTransaction(id);
  if (
    !existing ||
    existing.type !== "expense" ||
    !existing.reimbursable_amount ||
    existing.reimbursement_status !== "pending"
  ) {
    return;
  }
  await db.transactions.update(id, {
    reimbursement_status: "received",
    ...touchMeta(),
  });
}

/** Undo 銷帳: back to pending (still no cash change). */
export async function undoReimbursementReceived(id: string): Promise<void> {
  const existing = await getTransaction(id);
  if (
    !existing ||
    existing.type !== "expense" ||
    !existing.reimbursable_amount ||
    existing.reimbursement_status !== "received"
  ) {
    return;
  }
  await db.transactions.update(id, {
    reimbursement_status: "pending",
    ...touchMeta(),
  });
}

/** Mark a hold as refunded: creates matching income and links it. */
export async function releaseHold(
  id: string,
  releaseDate = todayIso(),
): Promise<Transaction | undefined> {
  let income: Transaction | undefined;

  await db.transaction("rw", db.transactions, async () => {
    const existing = await db.transactions.get(id);
    if (
      !existing ||
      existing.deleted_at ||
      existing.type !== "hold" ||
      (existing.hold_status ?? "held") !== "held"
    ) {
      return;
    }

    const note = existing.note.trim()
      ? `退回：${existing.note.trim()}`
      : "退回：扣住款項";

    income = {
      ...baseMeta(),
      book_id: existing.book_id,
      type: "income",
      amount: existing.amount,
      date: releaseDate,
      note,
      account_id: existing.account_id,
      category_id: null,
      transfer_account_id: null,
      hold_status: null,
      release_transaction_id: null,
      reimbursable_amount: null,
      reimbursement_status: null,
      holding_id: null,
      tag: null,
      target_holding_id: null,
    };
    await db.transactions.add(income);
    await db.transactions.update(existing.id, {
      hold_status: "released",
      release_transaction_id: income.id,
      updated_at: nowIso(),
      client_id: getClientId(),
      sync_status: "pending",
    });
  });

  return income;
}

export async function listTransactionsForAccount(
  bookId: string,
  accountId: string,
): Promise<Transaction[]> {
  const rows = await bookTransactions(bookId)
    .filter(
      (row) =>
        !row.deleted_at &&
        // Dollar-cost rows move holdings, not this cash-flow account.
        row.type !== "invest" &&
        (row.account_id === accountId || row.transfer_account_id === accountId),
    )
    .reverse()
    .toArray();

  const categories = await listCategories(bookId);
  const names = new Map(categories.map((row) => [row.id, row.name]));
  const nameOf = (categoryId: string | null) =>
    categoryId ? names.get(categoryId) : null;

  return rows
    .sort((a, b) => compareMonthTransactions(a, b, nameOf))
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
    } else if (tx.type === "expense" || tx.type === "hold") {
      add(tx.account_id, -tx.amount);
    } else if (tx.type === "transfer") {
      add(tx.account_id, -tx.amount);
      add(tx.transfer_account_id, tx.amount);
    }
  }

  return accounts.map((account) => ({
    account,
    balance: (account.opening_balance ?? 0) + (deltas.get(account.id) ?? 0),
  }));
}

/** Pending 核銷 and unreleased 扣住, oldest first. Not limited to one month. */
export async function listOpenItems(bookId: string): Promise<Transaction[]> {
  const rows = await bookTransactions(bookId)
    .filter((row) => !row.deleted_at && isOpenItem(row))
    .toArray();
  return rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.note.localeCompare(b.note, "zh-Hant"),
  );
}

/** Sum of live 扣住 rows that have not been refunded yet. */
export async function outstandingHeldTotal(bookId: string): Promise<number> {
  const rows = await bookTransactions(bookId)
    .filter(
      (row) =>
        !row.deleted_at &&
        row.type === "hold" &&
        (row.hold_status ?? "held") === "held",
    )
    .toArray();
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

export async function bookTotals(
  bookId: string,
): Promise<{ total: number; accounts: number; holdings: number; held: number }> {
  const [balances, holdings, held] = await Promise.all([
    accountBalances(bookId),
    listHoldings(bookId),
    outstandingHeldTotal(bookId),
  ]);
  const accounts = balances.reduce((sum, item) => sum + item.balance, 0);
  const holdingSum = holdings.reduce((sum, item) => sum + item.amount, 0);
  return {
    accounts,
    holdings: holdingSum,
    held,
    // Wealth headline = deposits only. Outstanding holds are cash still yours
    // but already reflected in day-to-day accounts when refunded; do not add held
    // here or 淨資產 drops on 已退回.
    total: holdingSum,
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
 * holding is unchanged — this is a normal income row, not a balance rewrite.
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

export function monthSummary(transactions: Transaction[]): PeriodSummary {
  // Same-period holds point at their refund income; cross-month refunds use the note prefix.
  const releaseIncomeIds = new Set(
    transactions
      .filter((tx) => tx.type === "hold" && tx.release_transaction_id)
      .map((tx) => tx.release_transaction_id as string),
  );

  let income = 0;
  let expense = 0;
  let held = 0;
  let reimbursablePending = 0;
  let reimbursableReceived = 0;
  for (const tx of transactions) {
    if (tx.type === "income") {
      if (
        releaseIncomeIds.has(tx.id) ||
        tx.note.startsWith("退回：")
      ) {
        continue;
      }
      income += tx.amount;
    }
    if (tx.type === "expense") {
      expense += tx.amount;
      if (tx.reimbursable_amount != null && tx.reimbursable_amount > 0) {
        if (tx.reimbursement_status === "pending") {
          reimbursablePending += tx.reimbursable_amount;
        } else if (tx.reimbursement_status === "received") {
          reimbursableReceived += tx.reimbursable_amount;
        }
      }
    }
    // Count every hold in-period so later「已退回」does not erase that month's 花費.
    if (tx.type === "hold") held += tx.amount;
  }
  const selfPay = Math.max(0, expense - reimbursableReceived);
  return {
    income,
    expense,
    held,
    outflow: selfPay + held,
    // Net uses full cash expense so salary/補助 income is not double-counted.
    net: income - expense,
    reimbursablePending,
    selfPay,
  };
}

export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  type: "income" | "expense" = "expense",
): CategoryBreakdownItem[] {
  const map = new Map<string | null, { amount: number; treatAmount: number }>();
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const key = tx.category_id;
    const amount =
      type === "expense" ? expenseDisplayAmount(tx) : tx.amount;
    const bucket = map.get(key) ?? { amount: 0, treatAmount: 0 };
    bucket.amount += amount;
    if (type === "expense" && tx.tag === TREAT_TAG) bucket.treatAmount += amount;
    map.set(key, bucket);
  }

  const total = [...map.values()].reduce((sum, bucket) => sum + bucket.amount, 0);
  const categoryMap = Object.fromEntries(
    categories.map((category) => [category.id, category]),
  );

  return [...map.entries()]
    .map(([categoryId, bucket]) => {
      const category = categoryId ? categoryMap[categoryId] : undefined;
      return {
        categoryId,
        name: category?.name ?? "未分類",
        color: category?.color ?? "#7f8c8d",
        icon: category?.icon ?? "dots",
        amount: bucket.amount,
        percent: total > 0 ? (bucket.amount / total) * 100 : 0,
        treatAmount: bucket.treatAmount,
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
      held: 0,
      transactions: [],
    };
    if (tx.type === "income") bucket.income += tx.amount;
    if (tx.type === "expense") bucket.expense += expenseDisplayAmount(tx);
    if (tx.type === "hold") bucket.held += tx.amount;
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
    if (tx.type === "expense") {
      months[month - 1].expense += expenseDisplayAmount(tx);
    }
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
    if (tx.type === "expense") expense += expenseDisplayAmount(tx);
  }
  return expense / daysInPeriod;
}

export function compareSummaries(
  current: PeriodSummary,
  previous: PeriodSummary,
): SummaryComparison {
  const incomeDelta = current.income - previous.income;
  const expenseDelta = current.selfPay - previous.selfPay;
  return {
    incomeDelta,
    expenseDelta,
    incomePercent:
      previous.income === 0 ? 0 : (incomeDelta / previous.income) * 100,
    expensePercent:
      previous.selfPay === 0 ? 0 : (expenseDelta / previous.selfPay) * 100,
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
    if (tx.type === "expense") point.expense += expenseDisplayAmount(tx);
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