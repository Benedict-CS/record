"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useBook } from "@/components/BookProvider";
import { formatMoney } from "@/lib/format";
import { holdingsInterestSummary } from "@/lib/interest";
import {
  useAccountBalances,
  useHoldings,
  useOutstandingHeld,
} from "@/lib/hooks/useLedgerData";

/**
 * Wealth snapshot from 存款／資產 only.
 * Outstanding 扣住 is shown as a footnote (cash still yours in day-to-day accounts)
 * and is not added into the headline, so 已退回 does not drop 淨資產.
 */
export function NetWorthCard() {
  const { book } = useBook();
  const balances = useAccountBalances();
  const holdings = useHoldings();
  const held = useOutstandingHeld();
  const currency = book?.currency ?? "TWD";

  const accountsTotal = useMemo(
    () => balances.reduce((sum, item) => sum + item.balance, 0),
    [balances],
  );
  const holdingsTotal = useMemo(
    () => holdings.reduce((sum, item) => sum + item.amount, 0),
    [holdings],
  );
  const interest = useMemo(
    () => holdingsInterestSummary(holdings),
    [holdings],
  );

  return (
    <Link
      href="/holdings"
      className="block rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 active:bg-[rgba(28,43,36,0.04)] sm:px-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-[var(--muted)]">淨資產 = 存款／資產</p>
          <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-[var(--ink)]">
            {formatMoney(holdingsTotal, currency)}
          </p>
        </div>
        <span className="shrink-0 pt-0.5 text-xs text-[var(--accent)]">
          存款頁 ›
        </span>
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
        <p className="min-w-0 text-[var(--muted)]">
          記帳帳戶{" "}
          <span className="font-medium tabular-nums text-[var(--ink)]">
            {formatMoney(accountsTotal, currency)}
          </span>
        </p>
        <p className="min-w-0 text-[var(--muted)]">
          尚未退回{" "}
          <span className="font-medium tabular-nums text-amber-800">
            {formatMoney(held, currency)}
          </span>
        </p>
      </div>

      <p className="mt-1.5 text-[11px] text-[var(--muted)]">
        記帳帳戶是日常流水，不計入上方淨資產
        {held > 0 ? "；尚未退回的扣住仍在帳戶流水裡" : ""}
      </p>

      {interest.monthly > 0 || interest.yearly > 0 ? (
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">
          預估月利息{" "}
          <span className="tabular-nums text-[var(--ink)]">
            {formatMoney(interest.monthly, currency)}
          </span>
          ／年{" "}
          <span className="tabular-nums text-[var(--ink)]">
            {formatMoney(interest.yearly, currency)}
          </span>
        </p>
      ) : null}
    </Link>
  );
}
