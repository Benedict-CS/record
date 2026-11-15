"use client";

import Link from "next/link";
import { useMemo } from "react";
import { accountLabel } from "@/lib/account-name";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { todayLocal } from "@/lib/format";
import { getMaturingHoldings } from "@/lib/holding-maturity";
import { useHoldings, useOpenItems } from "@/lib/hooks/useLedgerData";

interface MoreLinkItem {
  href: string;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}

interface MoreSection {
  title: string;
  items: MoreLinkItem[];
}

export function MorePage() {
  const { user } = useAuth();
  const holdings = useHoldings();
  const openItems = useOpenItems();
  const today = todayLocal();

  const maturingHoldings = useMemo(
    () => getMaturingHoldings(holdings, today),
    [holdings, today],
  );

  const sections: MoreSection[] = [
    {
      title: "常用管理",
      items: [
        {
          href: "/categories",
          title: "分類",
          description: "收入與支出分類與自訂排序",
        },
        {
          href: "/budgets",
          title: "預算",
          description: "年預算與月預算規劃與進度上限",
        },
        {
          href: "/accounts",
          title: "帳戶",
          description: "現金、銀行與信用卡帳戶管理",
        },
        {
          href: "/books",
          title: "帳本",
          description: "多帳本管理與切換",
        },
      ],
    },
    {
      title: "記帳與進階工具",
      items: [
        {
          href: "/recurring",
          title: "每月固定",
          description: "薪水、房貸、固定支出與定期定額",
        },
        {
          href: "/templates",
          title: "記帳範本",
          description: "一鍵套用常用收支模板",
        },
        {
          href: "/pending",
          title: "待辦與扣住",
          description: "待報銷款項、分帳待還與押金扣住",
          badge:
            openItems.length > 0
              ? `${openItems.length} 筆待處理`
              : undefined,
          badgeColor:
            "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-medium",
        },
        {
          href: "/search",
          title: "進階搜尋",
          description: "關鍵字、標籤與金額範圍搜尋",
        },
      ],
    },
    {
      title: "帳號與系統",
      items: [
        {
          href: "/settings",
          title: user ? "帳號設定" : "登入設定",
          description: user
            ? `已登入 ${accountLabel(user)} · 密碼修改、雲端同步與備份`
            : "開啟跨裝置雲端同步與備份",
          badge: user ? "已同步" : undefined,
          badgeColor: "text-[var(--accent)]",
        },
      ],
    },
  ];

  return (
    <AppShell title="更多">
      <div className="space-y-4">
        {maturingHoldings.length > 0 ? (
          <Link
            href="/holdings"
            className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-sky-200/80 bg-sky-50/80 dark:border-sky-900/40 dark:bg-sky-950/20 px-4 py-3 text-left transition active:bg-sky-100 dark:active:bg-sky-950/40"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-base shrink-0" aria-hidden>
                ⏳
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sky-950 dark:text-sky-100">
                  定存／合約到期提醒（{maturingHoldings.length} 筆）
                </p>
                <p className="truncate text-[11px] text-sky-800/90 dark:text-sky-300">
                  {maturingHoldings[0].holding.name} {maturingHoldings[0].label}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-medium text-sky-900 dark:text-sky-200">
              前往存款 ›
            </span>
          </Link>
        ) : null}

        {sections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            <h2 className="px-1 text-xs font-medium text-[var(--muted)]">
              {section.title}
            </h2>
            <ul className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              {section.items.map((item, index) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={[
                      "flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition active:bg-[var(--paper)]",
                      index > 0 ? "border-t border-[var(--line)]" : "",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--ink)]">
                        {item.title}
                        {item.badge ? (
                          <span
                            className={`ml-2 rounded-md px-1.5 py-0.5 text-xs font-normal ${
                              item.badgeColor ?? "text-[var(--accent)]"
                            }`}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {item.description}
                      </p>
                    </div>
                    <span className="text-[var(--muted)]" aria-hidden>
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
