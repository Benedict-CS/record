"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { BackupNudge } from "@/components/BackupNudge";
import { BottomSheet } from "@/components/BottomSheet";
import { MonthBudgetHint } from "@/components/MonthBudgetHint";
import { PendingHomeLink } from "@/components/PendingList";
import { UpcomingRecurring } from "@/components/UpcomingRecurring";
import { useBook } from "@/components/BookProvider";
import { MonthSummary } from "@/components/MonthSummary";
import { QuickTemplateBar } from "@/components/QuickTemplateBar";
import { RecurringPage } from "@/components/RecurringPage";
import { TransactionEditor } from "@/components/TransactionEditor";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionList } from "@/components/TransactionList";
import { useToast } from "@/components/ToastProvider";
import {
  findLatestTransactionMonth,
  listTransactionsForMonth,
} from "@/lib/db/crud";
import { formatDayHeading, todayLocal } from "@/lib/format";
import { clampLedgerPeriod } from "@/lib/period-jump";
import {
  useAccounts,
  useCategories,
  useLedgerEndYear,
  useMonthTransactions,
  useSeedReady,
} from "@/lib/hooks/useLedgerData";
import type { Transaction } from "@/lib/types";

export function HomePage() {
  const ready = useSeedReady();
  const { bookId } = useBook();
  const today = todayLocal();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  /** When set, the add sheet is for this day. Null means today (the FAB). */
  const [addDate, setAddDate] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"once" | "monthly">("once");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "expense" | "income" | "hold"
  >("all");
  const { show } = useToast();
  const openedForBook = useRef<string | null>(null);
  const pinnedPeriod = useRef(false);

  const accounts = useAccounts();
  const categories = useCategories();
  const transactions = useMonthTransactions(year, month);
  const endYear = useLedgerEndYear();

  // /?y=2025&m=12 opens that month (year report). Done before the empty-month jump.
  useEffect(() => {
    if (endYear == null) return;
    const params = new URLSearchParams(window.location.search);
    const nextYear = Number(params.get("y"));
    const nextMonth = Number(params.get("m"));
    if (!nextYear || nextMonth < 1 || nextMonth > 12) return;
    const period = clampLedgerPeriod(nextYear, nextMonth, endYear);
    pinnedPeriod.current = true;
    // The query string exists only in the browser, so the server render stays on this month.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setYear(period.year);
    setMonth(period.month);
    const url = new URL(window.location.href);
    url.searchParams.delete("y");
    url.searchParams.delete("m");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, "", next);
  }, [endYear]);

  // Deep link /#quick-add (reminder, other pages) opens the add sheet.
  useEffect(() => {
    function openFromHash() {
      if (window.location.hash === "#quick-add") {
        setAddDate(null);
        setAddMode("once");
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
    if (pinnedPeriod.current) {
      openedForBook.current = bookId;
      return;
    }
    if (transactions.length > 0) {
      openedForBook.current = bookId;
      return;
    }
    if (openedForBook.current === bookId) return;
    let cancelled = false;
    void (async () => {
      const current = await listTransactionsForMonth(
        bookId,
        currentYear,
        currentMonth,
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
        (latest.year !== currentYear || latest.month !== currentMonth)
      ) {
        const next = clampLedgerPeriod(latest.year, latest.month, endYear);
        setYear(next.year);
        setMonth(next.month);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, bookId, currentYear, currentMonth, transactions.length, endYear]);

  const visibleTransactions = useMemo(() => {
    if (typeFilter === "all") return transactions;
    return transactions.filter((tx) => tx.type === typeFilter);
  }, [transactions, typeFilter]);

  const isCurrentMonth = year === currentYear && month === currentMonth;

  function jumpTo(nextYear: number, nextMonth: number) {
    const next = clampLedgerPeriod(nextYear, nextMonth, endYear);
    setYear(next.year);
    setMonth(next.month);
  }

  function shiftMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    jumpTo(date.getFullYear(), date.getMonth() + 1);
  }

  function goToCurrentMonth() {
    jumpTo(currentYear, currentMonth);
  }

  function openAdd(date?: string) {
    setAddDate(date ?? null);
    setAddMode("once");
    setAddOpen(true);
  }

  function jumpToDate(isoDate: string) {
    const nextYear = Number(isoDate.slice(0, 4));
    const nextMonth = Number(isoDate.slice(5, 7));
    if (!nextYear || !nextMonth) return;
    jumpTo(nextYear, nextMonth);
    window.setTimeout(() => {
      document
        .getElementById(`day-${isoDate}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  const addDay = addDate ? Number(addDate.slice(8, 10)) : undefined;

  function closeAddSheet() {
    setAddOpen(false);
    setAddDate(null);
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
        <div className="space-y-3">
          <MonthSummary
            year={year}
            month={month}
            transactions={transactions}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
            onJump={jumpTo}
            onGoCurrent={!isCurrentMonth ? goToCurrentMonth : undefined}
          />
          <div className="flex gap-2 empty:hidden">
            <BackupNudge />
            <PendingHomeLink />
          </div>
          <MonthBudgetHint
            year={year}
            month={month}
            transactions={transactions}
          />
          <UpcomingRecurring />
          <QuickTemplateBar />
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-[var(--ink)]">
                {isCurrentMonth ? "本月明細" : `${month} 月明細`}
              </h2>
              <div className="flex items-center gap-2">
                {isCurrentMonth ? (
                  <button
                    type="button"
                    onClick={() => jumpToDate(today)}
                    className="min-h-11 rounded-xl px-2 text-xs font-medium text-[var(--accent)]"
                  >
                    今天
                  </button>
                ) : null}
                <Link
                  href="/search"
                  className="inline-flex min-h-11 items-center rounded-xl px-2 text-xs font-medium text-[var(--accent)]"
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
                    "min-h-11 rounded-xl text-xs font-medium",
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
                onAddForDate={openAdd}
                groupByDay
                emptyMessage="這個月還沒有紀錄，點下方 + 開始。"
              />
            )}
          </section>
        </div>
      )}

      <BottomSheet
        open={addOpen}
        onClose={closeAddSheet}
        title={
          addMode === "monthly"
            ? "每月固定"
            : addDate
              ? `記一筆 · ${formatDayHeading(addDate)}`
              : "記一筆"
        }
        description={
          addMode === "monthly"
            ? "薪水、房貸、房租、訂閱，或 0050 這類定期定額"
            : "支出／收入／扣住（押金）。請客金額可填 0"
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(
            [
              ["once", "記一筆"],
              ["monthly", "每月固定"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={addMode === id}
              onClick={() => setAddMode(id)}
              className={[
                "min-h-11 rounded-xl text-sm font-medium",
                addMode === id
                  ? "bg-[var(--ink)] text-[var(--paper)]"
                  : "border border-[var(--line)] bg-[var(--paper)] text-[var(--muted)]",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        {addMode === "once" ? (
          <TransactionForm
            key={`${addOpen ? "open" : "closed"}-${addDate ?? "today"}`}
            bare
            defaultDate={addDate ?? undefined}
            accounts={accounts}
            categories={categories}
            onSaved={(saved) => {
              closeAddSheet();
              jumpToDate(saved.date);
              show("已記一筆", { variant: "success" });
            }}
          />
        ) : (
          <RecurringPage
            key={`monthly-${addDate ?? "today"}`}
            embedded
            initialDay={addDay}
          />
        )}
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
        onClick={() => openAdd()}
        aria-label="記一筆"
        title="記一筆"
        className="quick-add-fab fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-2xl font-light leading-none text-[var(--paper)] shadow-lg shadow-[rgba(15,122,95,0.35)] transition"
      >
        +
      </button>
    </AppShell>
  );
}
