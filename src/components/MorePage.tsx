"use client";

import Link from "next/link";
import { useMemo } from "react";
import { accountLabel } from "@/lib/account-name";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { todayLocal } from "@/lib/format";
import { getMaturingHoldings } from "@/lib/holding-maturity";
import { useHoldings } from "@/lib/hooks/useLedgerData";

interface MoreLinkItem {
  href: string;
  title: string;
  description: string;
}

const LINKS: MoreLinkItem[] = [
  {
    href: "/categories",
    title: "分類",
    description: "收入與支出分類與排序",
  },
  {
    href: "/budgets",
    title: "預算",
    description: "設定每月與每年預算上限",
  },
  {
    href: "/recurring",
    title: "每月固定",
    description: "薪水、房貸、固定支出與定期定額",
  },
  {
    href: "/settings",
    title: "帳號設定",
    description: "帳號同步、密碼修改與登出",
  },
];

export function MorePage() {
  const { user } = useAuth();
  const holdings = useHoldings();
  const today = todayLocal();

  const maturingHoldings = useMemo(
    () => getMaturingHoldings(holdings, today),
    [holdings, today],
  );

  return (
    <AppShell title="更多">
      <div className="space-y-3">
        <p className="text-sm text-[var(--muted)]">
          管理分類、預算、固定項目與帳號設定。
        </p>

        {maturingHoldings.length > 0 ? (
          <Link
            href="/holdings"
            className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-left transition active:bg-amber-100"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-base shrink-0" aria-hidden>
                ⏳
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-950">
                  定存／合約到期提醒（{maturingHoldings.length} 筆）
                </p>
                <p className="truncate text-[11px] text-amber-800/90">
                  {maturingHoldings[0].holding.name} {maturingHoldings[0].label}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-medium text-amber-900">
              前往存款 ›
            </span>
          </Link>
        ) : null}

        <ul className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          {LINKS.map((item, index) => {
            const isSettings = item.href === "/settings";
            const displayTitle =
              isSettings && user
                ? "帳號設定"
                : isSettings
                  ? "登入設定"
                  : item.title;
            const displayDesc =
              isSettings && user
                ? `已登入 ${accountLabel(user)} · 修改密碼與登出`
                : item.description;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={[
                    "flex min-h-14 items-center justify-between gap-3 px-4 py-3 active:bg-[rgba(28,43,36,0.04)]",
                    index > 0 ? "border-t border-[var(--line)]" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--ink)]">
                      {displayTitle}
                      {isSettings && user ? (
                        <span className="ml-2 text-xs font-normal text-[var(--accent)]">
                          已同步
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {displayDesc}
                    </p>
                  </div>
                  <span className="text-[var(--muted)]" aria-hidden>
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
