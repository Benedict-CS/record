"use client";

import Link from "next/link";
import { accountLabel } from "@/lib/account-name";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";

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
    description: "設定每月預算上限",
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

  return (
    <AppShell title="更多">
      <div className="space-y-3">
        <p className="text-sm text-[var(--muted)]">
          管理分類、預算、固定項目與帳號設定。
        </p>

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
