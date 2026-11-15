"use client";

import { formatMoney } from "@/lib/format";
import type { MaturingHoldingInfo } from "@/lib/holding-maturity";
import type { Holding } from "@/lib/types";

export function MaturityNoticeCard({
  items,
  currency,
  onSelectHolding,
}: {
  items: MaturingHoldingInfo[];
  currency?: string;
  onSelectHolding?: (holding: Holding) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-sky-200/80 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/20 p-3.5 sm:p-4 text-[var(--ink)] shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base" aria-hidden>
            ⏳
          </span>
          <h2 className="text-sm font-semibold text-sky-950 dark:text-sky-100">
            定存／合約到期提醒
          </h2>
          <span className="rounded-full bg-sky-200/80 dark:bg-sky-900/60 px-2 py-0.5 text-[11px] font-semibold text-sky-900 dark:text-sky-200">
            {items.length}
          </span>
        </div>
        <p className="text-[11px] text-sky-800/80 dark:text-sky-300">點選可查看明細</p>
      </div>

      <ul className="mt-2.5 space-y-1.5">
        {items.map(({ holding, status, label }) => {
          const isOverdue = status === "overdue";
          const isToday = status === "today";

          return (
            <li key={holding.id}>
              <button
                type="button"
                onClick={() => onSelectHolding?.(holding)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left transition hover:border-sky-400 active:bg-sky-50 dark:active:bg-sky-950/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--ink)]">
                    {holding.name}
                    {holding.institution ? (
                      <span className="ml-1 text-xs font-normal text-[var(--muted)]">
                        · {holding.institution}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)] tabular-nums">
                    {holding.amount > 0 ? formatMoney(holding.amount, currency) : "未填金額"}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <span
                    className={[
                      "inline-block rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums",
                      isOverdue
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 font-semibold"
                        : isToday
                          ? "bg-sky-600 text-white font-semibold"
                          : "bg-sky-100 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200",
                    ].join(" ")}
                  >
                    {label}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
