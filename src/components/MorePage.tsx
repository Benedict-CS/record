"use client";

import Link from "next/link";
import { accountLabel } from "@/lib/account-name";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useBook } from "@/components/BookProvider";
import { useOpenItems } from "@/lib/hooks/useLedgerData";
import { groupOpenItems } from "@/lib/open-items";

interface MoreLinkItem {
  href: string;
  title: string;
  description: string;
}

const LINKS: MoreLinkItem[] = [
  {
    href: "/pending",
    title: "待處理",
    description: "還沒銷帳的核銷，和還沒退回的扣住",
  },
  {
    href: "/search",
    title: "搜尋",
    description: "依備註、分類、金額或日期找紀錄",
  },
  {
    href: "/books",
    title: "帳本",
    description: "新增、切換與管理帳本",
  },
  {
    href: "/categories",
    title: "分類",
    description: "收入與支出分類與排序",
  },
  {
    href: "/budgets",
    title: "預算",
    description: "設定每月預算上限",
  },
  {
    href: "/recurring",
    title: "每月固定",
    description: "薪水、房貸、固定支出與定期定額",
  },
  {
    href: "/settings",
    title: "帳號與設定",
    description: "帳號同步、密碼修改與 App 資訊",
  },
];

export function MorePage() {
  const { user } = useAuth();
  const { book } = useBook();
  const openCount = groupOpenItems(useOpenItems()).length;

  return (
    <AppShell title="更多">
      <div className="space-y-3">
        <p className="text-sm text-[var(--muted)]">
          管理帳本、分類、預算與帳號設定。
        </p>

        <ul className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          {LINKS.map((item, index) => {
            const isSettings = item.href === "/settings";
            const displayTitle =
              isSettings && user
                ? "帳號與設定"
                : isSettings
                  ? "登入與設定"
                  : item.title;
            const displayDesc =
              isSettings && user
                ? `已登入 ${accountLabel(user)} · 密碼與 App 資訊`
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
                      {item.href === "/pending" && openCount > 0 ? (
                        <span className="ml-2 text-xs font-normal tabular-nums text-[var(--accent)]">
                          {openCount} 件
                        </span>
                      ) : null}
                      {item.href === "/books" && book ? (
                        <span className="ml-2 text-xs font-normal text-[var(--accent)]">
                          {book.name}
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
