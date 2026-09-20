"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { BottomSheet } from "@/components/BottomSheet";
import { useBook } from "@/components/BookProvider";
import { MonthSummary } from "@/components/MonthSummary";
import { QuickTemplateBar } from "@/components/QuickTemplateBar";
import { TransactionEditor } from "@/components/TransactionEditor";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionList } from "@/components/TransactionList";
import { YearSpendCard } from "@/components/YearSpendCard";
import { useToast } from "@/components/ToastProvider";
import {
  findLatestTransactionMonth,
  listTransactionsForMonth,
} from "@/lib/db/crud";
import {
  useAccounts,
  useCategories,
  useMonthTransactions,
  useSeedReady,
} from "@/lib/hooks/useLedgerData";
import type { Transaction } from "@/lib/types";

export function HomePage() {
  const ready = useSeedReady();
  const { bookId } = useBook();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<
    "all" | "expense" | "income" | "hold"
  >("all");
  const { show } = useToast();
  const openedForBook = useRef<string | null>(null);

  const accounts = useAccounts();
  const categories = useCategories();
  const transactions = useMonthTransactions(year, month);

  // Deep link /#quick-add (reminder, other pages) opens the add sheet.
  useEffect(() => {
    function openFromHash() {
      if (window.location.hash === "#quick-add") {
        setAddOpen(true);
      }
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  // If this month is empty, open the latest month that still has data
  // (once per book). Stay on the real current month when the book is empty.
  useEffect(() => {
    if (!ready || !bookId) return;
    if (transactions.length > 0) {
      openedForBook.current = bookId;
      return;
    }
    if (openedForBook.current === bookId) return;
    let cancelled = false;
    void (async () => {
      const current = await listTransactionsForMonth(
        bookId,
        now.getFullYear(),
        now.getMonth() + 1,
      );
      if (cancelled) return;
      if (current.length > 0) {
        openedForBook.current = bookId;
        return;
      }
      const latest = await findLatestTransactionMonth(bookId);
      if (cancelled) return;
      openedForBook.current = bookId;
      if (
        latest &&
        (latest.year !== now.getFullYear() ||
          latest.month !== now.getMonth() + 1)
      ) {
        setYear(latest.year);
        setMonth(latest.month);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, bookId, now, transactions.length]);

  const visibleTransactions = useMemo(
    () =>
      typeFilter === "all"
        ? transactions
        : transactions.filter((tx) => tx.type === typeFilter),
    [transactions, typeFilter],
  );

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  function shiftMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
  }

  function goToCurrentMonth() {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  }

  function closeAddSheet() {
    setAddOpen(false);
    if (window.location.hash === "#quick-add") {
      history.replaceState(null, "", window.location.pathname);
    }
  }

  const shellTitle = isCurrentMonth ? "本月記帳" : `${year} 年 ${month} 月`;

  return (
    <AppShell title={shellTitle}>
      {!ready ? (
        <p className="text-sm text-[var(--muted)]">載入本機資料…</p>
      ) : (
        <div className="space-y-3 pb-16">
          <YearSpendCard year={year} />
          <MonthSummary
            year={year}
            month={month}
            transactions={transactions}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
            onGoCurrent={!isCurrentMonth ? goToCurrentMonth : undefined}
          />
          <QuickTemplateBar />
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-[var(--ink)]">
                {isCurrentMonth ? "本月明細" : `${month} 月明細`}
              </h2>
              <div className="flex items-center gap-2">
                <Link
                  href="/search"
                  className="text-xs text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  搜尋
                </Link>
                <span className="text-xs tabular-nums text-[var(--muted)]">
                  {visibleTransactions.length} 筆
                </span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  ["all", "全部"],
                  ["expense", "支出"],
                  ["income", "收入"],
                  ["hold", "扣住"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={typeFilter === id}
                  onClick={() => setTypeFilter(id)}
                  className={[
                    "min-h-10 rounded-xl text-xs font-medium",
                    typeFilter === id
                      ? id === "hold"
                        ? "bg-amber-800 text-white"
                        : "bg-[var(--ink)] text-[var(--paper)]"
                      : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)]",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
            {typeFilter !== "all" && visibleTransactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center">
                <p className="text-sm text-[var(--muted)]">
                  這個篩選目前沒有紀錄
                </p>
                <button
                  type="button"
                  onClick={() => setTypeFilter("all")}
                  className="mt-3 min-h-10 rounded-xl bg-[var(--ink)] px-4 text-xs font-medium text-[var(--paper)]"
                >
                  看全部
                </button>
              </div>
            ) : (
              <TransactionList
                transactions={visibleTransactions}
                accounts={accounts}
                categories={categories}
                onEdit={setEditing}
                groupByDay
                emptyMessage="這個月還沒有紀錄，點右下角 + 開始。"
              />
            )}
          </section>
        </div>
      )}

      <BottomSheet
        open={addOpen}
        onClose={closeAddSheet}
        title="記一筆"
        description="支出／收入／扣住（押金）。請客金額可填 0"
      >
        <TransactionForm
          key={addOpen ? "open" : "closed"}
          bare
          accounts={accounts}
          categories={categories}
          onSaved={() => {
            closeAddSheet();
            show("已記一筆", { variant: "success" });
          }}
        />
      </BottomSheet>

      {editing ? (
        <TransactionEditor
          transaction={editing}
          accounts={accounts}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="記一筆"
        title="記一筆"
        className="quick-add-fab fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-2xl font-light leading-none text-[var(--paper)] shadow-lg shadow-[rgba(15,122,95,0.35)] transition"
      >
        +
      </button>
    </AppShell>
  );
}
