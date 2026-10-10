"use client";

/**
 * Live-query hooks for Record (記帳本) local data.
 * File name still says LedgerData for older imports; product name is Record.
 */
import { liveQuery } from "dexie";
import { useEffect, useMemo, useState } from "react";
import { useBook } from "@/components/BookProvider";
import {
  accountBalances,
  findLatestBookedYear,
  listAccounts,
  listBudgets,
  listCategories,
  listTemplates,
  listTransactionsForDate,
  listTransactionsForMonth,
  listTransactionsForYear,
  listTransactionsBetween,
  listTransactionsForAccount,
  accountFlowTotals,
  listHoldings,
  listOpenItems,
  outstandingHeldTotal,
  searchTransactions,
} from "@/lib/db/crud";
import { listRecurringRules } from "@/lib/db/recurring-post";
import { ledgerEndYear } from "@/lib/period-jump";
import type {
  Account,
  AccountBalance,
  Book,
  Budget,
  Category,
  CategoryKind,
  Holding,
  RecurringRule,
  Template,
  Transaction,
} from "@/lib/types";

function useLiveQueryList<T>(
  factory: () => Promise<T[]>,
  deps: unknown[],
): { items: T[]; loading: boolean } {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{
    items: T[];
    loading: boolean;
    key: string;
  }>({ items: [], loading: true, key });
  if (state.key !== key) {
    setState({ items: [], loading: true, key });
  }

  useEffect(() => {
    let cancelled = false;
    const observable = liveQuery(() => factory());
    const subscription = observable.subscribe({
      next: (value) => {
        if (cancelled) return;
        setState({ items: value, loading: false, key });
      },
      error: () => {
        if (cancelled) return;
        setState({ items: [], loading: false, key });
      },
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { items: state.items, loading: state.loading };
}

function useLiveList<T>(factory: () => Promise<T[]>, deps: unknown[]) {
  return useLiveQueryList<T>(factory, deps).items;
}

export function useSeedReady() {
  const { ready } = useBook();
  return ready;
}

/** Undefined until the first read. Null when this book has no transactions. */
export function useLatestBookedYear(): number | null | undefined {
  const { bookId } = useBook();
  const [year, setYear] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (!bookId) return;
    const subscription = liveQuery(() => findLatestBookedYear(bookId)).subscribe({
      next: (value) => setYear(value),
      error: () => setYear(null),
    });
    return () => subscription.unsubscribe();
  }, [bookId]);

  if (!bookId) return null;
  return year;
}

/** Current year, or a later year that already has a transaction. Undefined until read. */
export function useLedgerEndYear(): number | undefined {
  const latest = useLatestBookedYear();
  if (latest === undefined) return undefined;
  return ledgerEndYear(new Date().getFullYear(), latest);
}

export function useAccounts() {
  const { bookId } = useBook();
  return useLiveList(
    () => (bookId ? listAccounts(bookId) : Promise.resolve([])),
    [bookId],
  );
}

export function useCategories(kind?: CategoryKind) {
  const { bookId } = useBook();
  return useLiveList(
    () => (bookId ? listCategories(bookId, kind) : Promise.resolve([])),
    [bookId, kind],
  );
}

export function useMonthTransactions(
  year: number,
  month: number,
  enabled = true,
) {
  const { bookId } = useBook();
  return useLiveList(
    () =>
      enabled && bookId
        ? listTransactionsForMonth(bookId, year, month)
        : Promise.resolve([]),
    [bookId, year, month, enabled],
  );
}

export function useMonthTransactionsQuery(year: number, month: number) {
  const { bookId } = useBook();
  return useLiveQueryList<Transaction>(
    () =>
      bookId
        ? listTransactionsForMonth(bookId, year, month)
        : Promise.resolve([]),
    [bookId, year, month],
  );
}

export function useOpenItems() {
  const { bookId } = useBook();
  return useLiveList(
    () => (bookId ? listOpenItems(bookId) : Promise.resolve([])),
    [bookId],
  );
}

export function useYearTransactions(year: number, enabled = true) {
  const { bookId } = useBook();
  return useLiveList(
    () =>
      enabled && bookId
        ? listTransactionsForYear(bookId, year)
        : Promise.resolve([]),
    [bookId, year, enabled],
  );
}

export function useTransactionsBetween(
  start: string,
  endExclusive: string,
  enabled = true,
) {
  const { bookId } = useBook();
  return useLiveList(
    () =>
      enabled && bookId
        ? listTransactionsBetween(bookId, start, endExclusive)
        : Promise.resolve([]),
    [bookId, start, endExclusive, enabled],
  );
}

export function useBudgets(year: number, month: number) {
  const { bookId } = useBook();
  return useLiveList(
    () =>
      bookId ? listBudgets(bookId, year, month) : Promise.resolve([]),
    [bookId, year, month],
  );
}

export function useSearchTransactions(query: string) {
  const { bookId } = useBook();
  return useLiveList(
    () =>
      bookId ? searchTransactions(bookId, query) : Promise.resolve([]),
    [bookId, query],
  );
}

export function useTemplates() {
  const { bookId } = useBook();
  return useLiveList<Template>(
    () => (bookId ? listTemplates(bookId) : Promise.resolve([])),
    [bookId],
  );
}

export function useHoldings() {
  const { bookId } = useBook();
  return useLiveList<Holding>(
    () => (bookId ? listHoldings(bookId) : Promise.resolve([])),
    [bookId],
  );
}

export function useRecurringRules() {
  const { bookId } = useBook();
  return useLiveList<RecurringRule>(
    () => (bookId ? listRecurringRules(bookId) : Promise.resolve([])),
    [bookId],
  );
}

export function useAccountBalances() {
  const { bookId } = useBook();
  return useLiveList<AccountBalance>(
    () => (bookId ? accountBalances(bookId) : Promise.resolve([])),
    [bookId],
  );
}

function useLiveValue<T>(factory: () => Promise<T>, fallback: T, deps: unknown[]) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    const observable = liveQuery(() => factory());
    const subscription = observable.subscribe({
      next: (next) => setValue(next),
      error: () => setValue(fallback),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}

/** Outstanding 扣住 amount (not yet refunded). */
export function useOutstandingHeld() {
  const { bookId } = useBook();
  return useLiveValue(
    () => (bookId ? outstandingHeldTotal(bookId) : Promise.resolve(0)),
    0,
    [bookId],
  );
}

export function useAccountTransactions(accountId: string | null) {
  const { bookId } = useBook();
  return useLiveList<Transaction>(
    () =>
      bookId && accountId
        ? listTransactionsForAccount(bookId, accountId)
        : Promise.resolve([]),
    [bookId, accountId],
  );
}

export function useAccountFlowTotals(accountId: string | null) {
  const { bookId } = useBook();
  return useLiveValue(
    () =>
      bookId && accountId
        ? accountFlowTotals(bookId, accountId)
        : Promise.resolve({ income: 0, expense: 0, expenseCash: 0, held: 0 }),
    { income: 0, expense: 0, expenseCash: 0, held: 0 },
    [bookId, accountId],
  );
}

export function useDateTransactions(date: string) {
  return useDateTransactionsQuery(date).items;
}

export function useDateTransactionsQuery(date: string) {
  const { bookId } = useBook();
  return useLiveQueryList<Transaction>(
    () =>
      bookId && date
        ? listTransactionsForDate(bookId, date)
        : Promise.resolve([]),
    [bookId, date],
  );
}

/** Books are already tracked by BookProvider, so reuse its live list. */
export function useBooks() {
  const { books } = useBook();
  return books;
}

export function useAccountsMap(accounts: Account[]) {
  return useMemo(
    () => Object.fromEntries(accounts.map((account) => [account.id, account])),
    [accounts],
  );
}

export function useCategoriesMap(categories: Category[]) {
  return useMemo(
    () =>
      Object.fromEntries(categories.map((category) => [category.id, category])),
    [categories],
  );
}

export type {
  Account,
  AccountBalance,
  Book,
  Budget,
  Category,
  Holding,
  RecurringRule,
  Template,
  Transaction,
};