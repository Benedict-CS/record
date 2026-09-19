"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { TransactionEditor } from "@/components/TransactionEditor";
import { TransactionList } from "@/components/TransactionList";
import { formatMoney } from "@/lib/format";
import {
  compareMonthTransactions,
  compareSameDayTransactions,
} from "@/lib/day-order";
import {
  useAccounts,
  useCategories,
  useSearchTransactions,
  useSeedReady,
  useYearTransactions,
} from "@/lib/hooks/useLedgerData";
import type { Transaction, TransactionType } from "@/lib/types";

type TypeFilter = "all" | TransactionType;
type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

const TYPE_OPTIONS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "expense", label: "支出" },
  { id: "income", label: "收入" },
  { id: "hold", label: "扣住" },
];

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "date-desc", label: "日期新→舊" },
  { id: "date-asc", label: "日期舊→新" },
  { id: "amount-desc", label: "金額大→小" },
  { id: "amount-asc", label: "金額小→大" },
];

/**
 * `searchTransactions("")` intentionally returns nothing, so filter-only
 * searches fall back to whole-year fetches. We load at most this many years,
 * anchored on the end of the selected date range (or the current year), which
 * keeps the number of live queries bounded on a phone.
 */
const FALLBACK_YEAR_SPAN = 3;
const SKIP_YEAR = 0;

function toggleId(list: string[], id: string) {
  return list.includes(id)
    ? list.filter((value) => value !== id)
    : [...list, id];
}

export function SearchPage() {
  const ready = useSeedReady();
  const { book } = useBook();
  const currency = book?.currency;
  const accounts = useAccounts();
  const categories = useCategories();

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [type, setType] = useState<TypeFilter>("all");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [editing, setEditing] = useState<Transaction | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(input.trim());
    }, 200);
    return () => window.clearTimeout(timer);
  }, [input]);

  const activeFilterCount =
    (type === "all" ? 0 : 1) +
    (categoryIds.length > 0 ? 1 : 0) +
    (accountIds.length > 0 ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (amountMin.trim() || amountMax.trim() ? 1 : 0);
  const hasFilters = activeFilterCount > 0;
  const usingFallback = !query && hasFilters;

  const fallback = useMemo(() => {
    if (!usingFallback) {
      return { years: [SKIP_YEAR, SKIP_YEAR, SKIP_YEAR], from: 0, to: 0 };
    }
    const currentYear = new Date().getFullYear();
    const fromYear = dateFrom ? Number(dateFrom.slice(0, 4)) : NaN;
    const toYear = dateTo ? Number(dateTo.slice(0, 4)) : NaN;
    const end = Number.isFinite(toYear) ? toYear : currentYear;
    const wanted = Number.isFinite(fromYear)
      ? fromYear
      : end - (FALLBACK_YEAR_SPAN - 1);
    const start = Math.max(
      Math.min(wanted, end),
      end - (FALLBACK_YEAR_SPAN - 1),
    );
    const years = Array.from({ length: FALLBACK_YEAR_SPAN }, (_, index) => {
      const year = start + index;
      return year <= end ? year : SKIP_YEAR;
    });
    return { years, from: start, to: end };
  }, [usingFallback, dateFrom, dateTo]);

  const keywordResults = useSearchTransactions(query);
  const fallbackA = useYearTransactions(fallback.years[0]);
  const fallbackB = useYearTransactions(fallback.years[1]);
  const fallbackC = useYearTransactions(fallback.years[2]);

  const base = useMemo(() => {
    if (query) return keywordResults;
    if (!hasFilters) return [] as Transaction[];
    const merged = new Map<string, Transaction>();
    for (const list of [fallbackA, fallbackB, fallbackC]) {
      for (const tx of list) merged.set(tx.id, tx);
    }
    return [...merged.values()];
  }, [query, keywordResults, hasFilters, fallbackA, fallbackB, fallbackC]);

  const results = useMemo(() => {
    const min = amountMin.trim() ? Number(amountMin) : null;
    const max = amountMax.trim() ? Number(amountMax) : null;
    const categorySet = new Set(categoryIds);
    const accountSet = new Set(accountIds);

    const rows = base.filter((tx) => {
      if (type !== "all" && tx.type !== type) return false;
      if (categorySet.size > 0) {
        if (!tx.category_id || !categorySet.has(tx.category_id)) return false;
      }
      if (accountSet.size > 0) {
        const matched =
          accountSet.has(tx.account_id) ||
          (tx.transfer_account_id
            ? accountSet.has(tx.transfer_account_id)
            : false);
        if (!matched) return false;
      }
      if (dateFrom && tx.date < dateFrom) return false;
      if (dateTo && tx.date > dateTo) return false;
      if (min !== null && Number.isFinite(min) && tx.amount < min) return false;
      if (max !== null && Number.isFinite(max) && tx.amount > max) return false;
      return true;
    });

    const nameOf = (categoryId: string | null) => {
      const hit = categories.find((row) => row.id === categoryId);
      return hit?.name;
    };

    return rows.sort((a, b) => {
      switch (sort) {
        case "date-asc":
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return compareSameDayTransactions(a, b, nameOf);
        case "amount-desc":
          return b.amount - a.amount;
        case "amount-asc":
          return a.amount - b.amount;
        default:
          return compareMonthTransactions(a, b, nameOf);
      }
    });
  }, [
    base,
    type,
    categoryIds,
    accountIds,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    sort,
    categories,
  ]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let held = 0;
    for (const tx of results) {
      if (tx.type === "income") income += tx.amount;
      if (tx.type === "expense") expense += tx.amount;
      if (tx.type === "hold") held += tx.amount;
    }
    return { income, expense, held };
  }, [results]);

  function clearFilters() {
    setType("all");
    setCategoryIds([]);
    setAccountIds([]);
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
  }

  const searching = Boolean(query) || hasFilters;
  const fallbackNotice =
    usingFallback && fallback.to >= fallback.from
      ? fallback.from === fallback.to
        ? `未輸入關鍵字，僅載入 ${fallback.from} 年的紀錄`
        : `未輸入關鍵字，僅載入 ${fallback.from}–${fallback.to} 年的紀錄`
      : null;

  return (
    <AppShell title="搜尋">
      {!ready ? (
        <p className="text-sm text-[var(--muted)]">載入本機資料…</p>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">
              搜尋備註、分類、金額或日期
            </span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="例如：午餐、咖啡、500、2026-09"
              className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
              className="flex min-h-11 flex-1 items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--ink)]"
            >
              <span className="flex items-center gap-2">
                篩選
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-medium text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </span>
              <span aria-hidden className="text-xs text-[var(--muted)]">
                {showFilters ? "收合" : "展開"}
              </span>
            </button>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 shrink-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--muted)]"
              >
                清除篩選
              </button>
            ) : null}
          </div>

          {showFilters ? (
            <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3.5">
              <div>
                <span className="mb-1.5 block text-xs text-[var(--muted)]">
                  類型
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setType(option.id)}
                      aria-pressed={type === option.id}
                      className={[
                        "min-h-11 rounded-xl px-2 text-xs font-medium transition",
                        type === option.id
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--paper)] text-[var(--muted)]",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs text-[var(--muted)]">
                  分類
                  {categoryIds.length > 0 ? `（${categoryIds.length}）` : ""}
                </span>
                {categories.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">尚無分類</p>
                ) : (
                  <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                    {categories.map((category) => {
                      const selected = categoryIds.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() =>
                            setCategoryIds((list) =>
                              toggleId(list, category.id),
                            )
                          }
                          aria-pressed={selected}
                          className={[
                            "flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs transition",
                            selected
                              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                              : "border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]",
                          ].join(" ")}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: category.color }}
                            aria-hidden
                          />
                          {category.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <span className="mb-1.5 block text-xs text-[var(--muted)]">
                  帳戶{accountIds.length > 0 ? `（${accountIds.length}）` : ""}
                </span>
                {accounts.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">尚無帳戶</p>
                ) : (
                  <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                    {accounts.map((account) => {
                      const selected = accountIds.includes(account.id);
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() =>
                            setAccountIds((list) => toggleId(list, account.id))
                          }
                          aria-pressed={selected}
                          className={[
                            "min-h-11 rounded-full border px-3 text-xs transition",
                            selected
                              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                              : "border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]",
                          ].join(" ")}
                        >
                          {account.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <span className="mb-1.5 block text-xs text-[var(--muted)]">
                  日期範圍
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(event) => setDateFrom(event.target.value)}
                    aria-label="開始日期"
                    className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  />
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(event) => setDateTo(event.target.value)}
                    aria-label="結束日期"
                    className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs text-[var(--muted)]">
                  金額範圍
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={amountMin}
                    onChange={(event) => setAmountMin(event.target.value)}
                    placeholder="最小"
                    aria-label="最小金額"
                    className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={amountMax}
                    onChange={(event) => setAmountMax(event.target.value)}
                    placeholder="最大"
                    aria-label="最大金額"
                    className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <span className="mb-1.5 block text-xs text-[var(--muted)]">
              排序
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSort(option.id)}
                  aria-pressed={sort === option.id}
                  className={[
                    "min-h-11 rounded-xl border px-2 text-xs font-medium transition",
                    sort === option.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium text-[var(--ink)]">
                {searching ? `結果（${results.length}）` : "搜尋結果"}
              </h2>
            </div>

            {searching && results.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
                  <p className="text-[11px] text-[var(--muted)]">實際花掉</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-rose-700">
                    {formatMoney(totals.expense, currency)}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
                  <p className="text-[11px] text-[var(--muted)]">被扣住</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-800">
                    {formatMoney(totals.held, currency)}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
                  <p className="text-[11px] text-[var(--muted)]">收入合計</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-700">
                    {formatMoney(totals.income, currency)}
                  </p>
                </div>
              </div>
            ) : null}

            {fallbackNotice ? (
              <p className="text-[11px] text-[var(--muted)]">
                {fallbackNotice}
              </p>
            ) : null}
            {query && keywordResults.length >= 200 ? (
              <p className="text-[11px] text-[var(--muted)]">
                關鍵字結果最多顯示 200 筆，可加上篩選縮小範圍
              </p>
            ) : null}

            {!searching ? (
              <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                輸入關鍵字，或展開篩選條件開始搜尋
              </p>
            ) : results.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                {hasFilters
                  ? "找不到符合條件的紀錄，試著放寬篩選"
                  : "找不到符合的紀錄"}
              </p>
            ) : (
              <TransactionList
                transactions={results}
                accounts={accounts}
                categories={categories}
                onEdit={setEditing}
                emptyMessage="找不到符合的紀錄"
              />
            )}
          </section>
        </div>
      )}
      {editing ? (
        <TransactionEditor
          transaction={editing}
          accounts={accounts}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </AppShell>
  );
}
