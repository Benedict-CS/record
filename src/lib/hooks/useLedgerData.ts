"use client";

/**
 * Live-query hooks for Record (記帳本) local data.
 * File name still says LedgerData for older imports; product name is Record.
 */
import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { useBook } from "@/components/BookProvider";
import {
  accountBalances,
  listAccounts,
  listBudgets,
  listCategories,
  listTemplates,
  listTransactionsForDate,
  listTransactionsForMonth,
  listTransactionsForYear,
  listTransactionsForAccount,
  listHoldings,
  outstandingHeldTotal,
  searchTransactions,
} from "@/lib/db/crud";
import type {
  Account,
  AccountBalance,
  Book,
  Budget,
  Category,
  CategoryKind,
  Holding,
  Template,
  Transaction,
} from "@/lib/types";

function useLiveList<T>(factory: () => Promise<T[]>, deps: unknown[]) {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    const observable = liveQuery(() => factory());
    const subscription = observable.subscribe({
      next: (value) => setItems(value),
      error: () => setItems([]),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return items;
}

export function useSeedReady() {
  const { ready } = useBook();
  return ready;
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

export function useMonthTransactions(year: number, month: number) {
  const { bookId } = useBook();
  return useLiveList(
    () =>
      bookId
        ? listTransactionsForMonth(bookId, year, month)
        : Promise.resolve([]),
    [bookId, year, month],
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

export function useDateTransactions(date: string) {
  const { bookId } = useBook();
  return useLiveList<Transaction>(
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
  return Object.fromEntries(accounts.map((account) => [account.id, account]));
}

export function useCategoriesMap(categories: Category[]) {
  return Object.fromEntries(
    categories.map((category) => [category.id, category]),
  );
}

export type {
  Account,
  AccountBalance,
  Book,
  Budget,
  Category,
  Holding,
  Template,
  Transaction,
};