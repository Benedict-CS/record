"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useBook } from "@/components/BookProvider";
import { formatMoney } from "@/lib/format";
import { holdingsInterestSummary } from "@/lib/interest";
import {
  useAccountBalances,
  useHoldings,
} from "@/lib/hooks/useLedgerData";

/** Compact home snapshot: accounts plus holdings, linking to the holdings page. */
export function NetWorthCard() {
  const { book } = useBook();
  const balances = useAccountBalances();
  const holdings = useHoldings();
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
  const netWorth = accountsTotal + holdingsTotal;

  return (
    <Link
      href="/holdings"
      className="block rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 active:bg-[rgba(28,43,36,0.04)] sm:px-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-[var(--muted)]">
            淨資產 = 帳戶餘額 + 存款資產
          </p>
          <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-[var(--ink)]">
            {formatMoney(netWorth, currency)}
          </p>
        </div>
        <span className="shrink-0 pt-0.5 text-xs text-[var(--accent)]">
          存款頁 ›
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
        <p className="min-w-0 text-[var(--muted)]">
          帳戶{" "}
          <span className="tabular-nums text-[var(--ink)]">
            {formatMoney(accountsTotal, currency)}
          </span>
        </p>
        <p className="min-w-0 text-[var(--muted)]">
          存款{" "}
          <span className="tabular-nums text-[var(--ink)]">
            {formatMoney(holdingsTotal, currency)}
          </span>
        </p>
      </div>
      {interest.monthly > 0 ? (
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
