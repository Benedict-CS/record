"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { DayTransactionPanel } from "@/components/DayTransactionPanel";
import { HoldStepButton } from "@/components/HoldStepButton";
import { PeriodJump } from "@/components/PeriodJump";
import { CalendarSkeleton, ListSkeleton } from "@/components/Skeleton";
import { TransactionEditor } from "@/components/TransactionEditor";
import { groupTransactionsByDay } from "@/lib/db/crud";
import {
  useAccounts,
  useCategories,
  useLedgerEndYear,
  useMonthTransactionsQuery,
  useSeedReady,
} from "@/lib/hooks/useLedgerData";
import { formatMoney, shiftYearMonth, todayLocal } from "@/lib/format";
import { clampLedgerPeriod } from "@/lib/period-jump";
import type { Transaction } from "@/lib/types";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"] as const;

function toDateKey(year: number, month: number, day: number) {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function compactMoney(value: number, currency?: string) {
  return formatMoney(value, currency).replace(/^[^\d-]+/, "").trim();
}

function buildCalendarCells(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  // Monday-first: Sun=0 → 6, Mon=1 → 0, …
  const leadingBlanks = (firstWeekday + 6) % 7;
  const cells: Array<number | null> = Array.from(
    { length: leadingBlanks },
    () => null,
  );
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function CalendarPage() {
  const { book } = useBook();
  const currency = book?.currency;
  const ready = useSeedReady();
  const today = todayLocal();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)));
  const [selectedDate, setSelectedDate] = useState(today);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const pendingEditId = useRef<string | null>(null);

  const accounts = useAccounts();
  const categories = useCategories();
  const { items: transactions, loading: monthLoading } =
    useMonthTransactionsQuery(year, month);
  const endYear = useLedgerEndYear();

  // Report rows link here as /calendar?date=YYYY-MM-DD&tx=<id>.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const date = params.get("date");
    const txId = params.get("tx");
    if (endYear == null) return;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m] = date.split("-").map(Number);
      if (y && m) {
        const next = clampLedgerPeriod(y, m, endYear);
        // The query string exists only in the browser. Setting it during render
        // would disagree with the server HTML.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
        setYear(next.year);
        setMonth(next.month);
        setSelectedDate(
          next.year === y && next.month === m
            ? date
            : toDateKey(next.year, next.month, 1),
        );
      }
    }
    if (txId) pendingEditId.current = txId;
  }, [endYear]);

  useEffect(() => {
    const id = pendingEditId.current;
    if (!id || !ready || monthLoading) return;
    const tx = transactions.find((item) => item.id === id);
    pendingEditId.current = null;
    if (tx) setEditing(tx);
    if (window.location.search) {
      window.history.replaceState(null, "", "/calendar");
    }
  }, [ready, monthLoading, transactions]);

  const dayMap = useMemo(() => {
    const map = new Map<
      string,
      {
        income: number;
        expense: number;
        held: number;
        transactions: typeof transactions;
      }
    >();
    for (const bucket of groupTransactionsByDay(transactions)) {
      map.set(bucket.date, bucket);
    }
    return map;
  }, [transactions]);

  const cells = useMemo(
    () => buildCalendarCells(year, month),
    [year, month],
  );

  const panelTransactions = useMemo(() => {
    if (!selectedDate) return [];
    const bucket = dayMap.get(selectedDate);
    if (bucket) return bucket.transactions;
    return transactions.filter((tx) => tx.date === selectedDate);
  }, [selectedDate, dayMap, transactions]);

  function shiftMonth(delta: number) {
    const next = shiftYearMonth(year, month, delta);
    jumpTo(next.year, next.month);
  }

  function jumpTo(nextYear: number, nextMonth: number) {
    const next = clampLedgerPeriod(nextYear, nextMonth, endYear);
    setYear(next.year);
    setMonth(next.month);
    const prefix = `${next.year}-${String(next.month).padStart(2, "0")}`;
    if (today.startsWith(prefix)) {
      setSelectedDate(today);
    } else {
      setSelectedDate(toDateKey(next.year, next.month, 1));
    }
  }

  return (
    <AppShell title="日曆">
      {!ready ? (
        <div className="space-y-4">
          <CalendarSkeleton />
          <ListSkeleton rows={3} />
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
            <div className="mb-3 flex items-center justify-between gap-1">
              <HoldStepButton
                ariaLabel="上一個月"
                title="上一個月，長按跳一年"
                className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)] active:scale-[0.98]"
                onStep={() => shiftMonth(-1)}
                onHold={() => shiftMonth(-12)}
              >
                ‹
              </HoldStepButton>
              <div className="flex min-w-0 flex-col items-center">
                <PeriodJump year={year} month={month} onChange={jumpTo} />
                {year !== Number(today.slice(0, 4)) ||
                month !== Number(today.slice(5, 7)) ||
                selectedDate !== today ? (
                  <button
                    type="button"
                    onClick={() => jumpTo(Number(today.slice(0, 4)), Number(today.slice(5, 7)))}
                    className="text-[11px] text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    今天
                  </button>
                ) : null}
              </div>
              <HoldStepButton
                ariaLabel="下一個月"
                title="下一個月，長按跳一年"
                className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)] active:scale-[0.98]"
                onStep={() => shiftMonth(1)}
                onHold={() => shiftMonth(12)}
              >
                ›
              </HoldStepButton>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((label) => (
                <div
                  key={label}
                  className="py-1 text-center text-[11px] text-[var(--muted)]"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, index) => {
                if (day === null) {
                  return (
                    <div
                      key={`blank-${index}`}
                      className="min-h-[4.25rem] rounded-xl"
                      aria-hidden
                    />
                  );
                }

                const dateKey = toDateKey(year, month, day);
                const bucket = dayMap.get(dateKey);
                const isToday = dateKey === today;
                const isSelected = dateKey === selectedDate;
                const labelParts = [`${year} 年 ${month} 月 ${day} 日`];
                if (isToday) labelParts.push("今天");
                if (bucket && bucket.expense > 0) {
                  labelParts.push(
                    `實際花掉 ${formatMoney(bucket.expense, currency)}`,
                  );
                }
                if (bucket && bucket.held > 0) {
                  labelParts.push(
                    `扣住 ${formatMoney(bucket.held, currency)}`,
                  );
                }
                if (bucket && bucket.income > 0) {
                  labelParts.push(
                    `收入 ${formatMoney(bucket.income, currency)}`,
                  );
                }

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => {
                      setSelectedDate(dateKey);
                      // Bring the day panel into view after selecting a cell.
                      window.requestAnimationFrame(() => {
                        document
                          .getElementById("day-panel")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }}
                    aria-label={labelParts.join("，")}
                    aria-pressed={isSelected}
                    className={[
                      "flex min-h-[4.25rem] flex-col items-stretch rounded-xl border px-1 py-1.5 text-left transition",
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : isToday
                          ? "border-[var(--accent)]/50 bg-[var(--paper)]"
                          : "border-transparent bg-[var(--paper)]/60 hover:border-[var(--line)]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday
                          ? "bg-[var(--ink)] text-[var(--paper)]"
                          : "text-[var(--ink)]",
                      ].join(" ")}
                    >
                      {day}
                    </span>
                    <span className="mt-auto space-y-0.5 px-0.5 pb-0.5">
                      {bucket && bucket.expense > 0 ? (
                        <span className="block truncate text-[10px] tabular-nums leading-tight text-rose-700">
                          -{compactMoney(bucket.expense, currency)}
                        </span>
                      ) : null}
                      {bucket && bucket.held > 0 ? (
                        <span className="block truncate text-[10px] tabular-nums leading-tight text-amber-800">
                          扣{compactMoney(bucket.held, currency)}
                        </span>
                      ) : null}
                      {bucket && bucket.income > 0 ? (
                        <span className="block truncate text-[10px] tabular-nums leading-tight text-emerald-700">
                          +{compactMoney(bucket.income, currency)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <DayTransactionPanel
            date={selectedDate}
            transactions={panelTransactions}
            accounts={accounts}
            categories={categories}
            onEdit={setEditing}
          />
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
