"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BottomSheet } from "@/components/BottomSheet";
import { useBook } from "@/components/BookProvider";
import { MonthSummary } from "@/components/MonthSummary";
import { NetWorthCard } from "@/components/NetWorthCard";
import { QuickTemplateBar } from "@/components/QuickTemplateBar";
import { TransactionEditor } from "@/components/TransactionEditor";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionList } from "@/components/TransactionList";
import { YearSpendCard } from "@/components/YearSpendCard";
import { useToast } from "@/components/ToastProvider";
import { listTransactionsForMonth } from "@/lib/db/crud";
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
      for (const [y, m] of [
        [2026, 9],
        [2026, 8],
      ] as const) {
        const rows = await listTransactionsForMonth(bookId, y, m);
        if (cancelled) return;
        if (rows.length > 0) {
          openedForBook.current = bookId;
          setYear(y);
          setMonth(m);
          return;
        }
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

  function shiftMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
  }

  function closeAddSheet() {
    setAddOpen(false);
    if (window.location.hash === "#quick-add") {
      history.replaceState(null, "", window.location.pathname);
    }
  }

  return (
    <AppShell title="本月記帳">
      {!ready ? (
        <p className="text-sm text-[var(--muted)]">載入本機資料…</p>
      ) : (
        <div className="space-y-3 pb-16">
          <NetWorthCard />
          <YearSpendCard year={year} />
          <MonthSummary
            year={year}
            month={month}
            transactions={transactions}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
          />
          <QuickTemplateBar />
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-[var(--ink)]">本月明細</h2>
              <span className="text-xs tabular-nums text-[var(--muted)]">
                {visibleTransactions.length} 筆
              </span>
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
            <TransactionList
              transactions={visibleTransactions}
              accounts={accounts}
              categories={categories}
              onEdit={setEditing}
              groupByDay
              emptyMessage={
                typeFilter === "all"
                  ? "這個月還沒有紀錄，點右下角 + 開始。"
                  : "這個篩選目前沒有紀錄"
              }
            />
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
        aria-label="新增記帳"
        title="新增記帳"
        className="quick-add-fab fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-2xl font-light leading-none text-[var(--paper)] shadow-lg shadow-[rgba(15,122,95,0.35)] transition"
      >
        +
      </button>
    </AppShell>
  );
}
