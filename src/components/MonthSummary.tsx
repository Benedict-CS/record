"use client";

import { useEffect } from "react";
import { useBook } from "@/components/BookProvider";
import { monthSummary } from "@/lib/db/crud";
import { formatMoney } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export function MonthSummary({
  year,
  month,
  transactions,
  onPrev,
  onNext,
  onGoCurrent,
}: {
  year: number;
  month: number;
  transactions: Transaction[];
  onPrev: () => void;
  onNext: () => void;
  onGoCurrent?: () => void;
}) {
  const { book } = useBook();
  const summary = monthSummary(transactions);
  const currency = book?.currency;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onPrev, onNext]);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 sm:px-4 sm:py-4">
      <div className="mb-2.5 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label="上一個月"
          title="← 上一個月"
          className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)] active:scale-[0.98]"
        >
          ‹
        </button>
        <div className="min-w-0 text-center">
          <p className="text-sm font-semibold tracking-wide tabular-nums text-[var(--ink)]">
            {year} 年 {month} 月
          </p>
          {onGoCurrent ? (
            <button
              type="button"
              onClick={onGoCurrent}
              className="mt-0.5 text-[11px] text-[var(--accent)] underline-offset-2 hover:underline"
            >
              回到本月
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onNext}
          aria-label="下一個月"
          title="→ 下一個月"
          className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)] active:scale-[0.98]"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        <div className="min-w-0 rounded-xl bg-[var(--paper)] px-2.5 py-2.5">
          <p className="text-[11px] text-[var(--muted)]">花費</p>
          <p className="mt-1 truncate text-base font-semibold tabular-nums text-[var(--ink)] sm:text-lg">
            {formatMoney(summary.outflow, currency)}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--muted)]">
            {summary.selfPay < summary.expense
              ? `已核銷後 · 帳戶實付 ${formatMoney(summary.expense + summary.held, currency)}`
              : "花掉＋扣住"}
          </p>
        </div>
        <div className="min-w-0 rounded-xl bg-amber-50 px-2.5 py-2.5">
          <p className="text-[11px] text-amber-900/70">被扣住</p>
          <p className="mt-1 truncate text-base font-semibold tabular-nums text-amber-900 sm:text-lg">
            {formatMoney(summary.held, currency)}
          </p>
          <p className="mt-0.5 text-[10px] text-amber-900/60">押金／預繳</p>
        </div>
        <div className="min-w-0 rounded-xl bg-[var(--paper)] px-2.5 py-2.5">
          <p className="text-[11px] text-[var(--muted)]">實際花掉</p>
          <p className="mt-1 truncate text-base font-semibold tabular-nums text-rose-700 sm:text-lg">
            {formatMoney(summary.selfPay, currency)}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--muted)]">
            {summary.selfPay < summary.expense
              ? `帳戶實付 ${formatMoney(summary.expense, currency)}`
              : "花費 − 被扣住"}
          </p>
        </div>
        <div className="min-w-0 rounded-xl bg-[var(--paper)] px-2.5 py-2.5">
          <p className="text-[11px] text-[var(--muted)]">結餘</p>
          <p className="mt-1 truncate text-base font-semibold tabular-nums text-[var(--ink)] sm:text-lg">
            {formatMoney(summary.net, currency)}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--muted)]">
            收入 {formatMoney(summary.income, currency)}
          </p>
        </div>
      </div>
      {summary.reimbursablePending > 0 ? (
        <p className="mt-2 text-[11px] tabular-nums text-sky-900/80">
          待報銷 {formatMoney(summary.reimbursablePending, currency)}
          <span className="text-[var(--muted)]"> · 入帳後按「銷帳」</span>
        </p>
      ) : null}
    </section>
  );
}
