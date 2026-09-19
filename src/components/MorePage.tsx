"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { BackupPanel } from "@/components/BackupPanel";
import { useBook } from "@/components/BookProvider";
import { ExportCsvButton } from "@/components/ExportCsvButton";

const LINKS: {
  href: string;
  title: string;
  description: string;
}[] = [
  {
    href: "/settings",
    title: "設定",
    description: "記帳提醒與安裝說明",
  },
  {
    href: "/books",
    title: "帳本",
    description: "新增、切換與管理帳本",
  },
  {
    href: "/accounts",
    title: "帳戶",
    description: "現金、銀行與信用卡",
  },
  {
    href: "/holdings",
    title: "存款／資產",
    description: "現金、定存、基金、電子錢包",
  },
  {
    href: "/categories",
    title: "分類",
    description: "收入與支出分類",
  },
  {
    href: "/budgets",
    title: "預算",
    description: "設定每月預算上限",
  },
  {
    href: "/templates",
    title: "範本",
    description: "常用記帳一鍵套用",
  },
  {
    href: "/login",
    title: "登入同步",
    description: "選用雲端備份與多裝置同步",
  },
];

export function MorePage() {
  const { user, configured } = useAuth();
  const { book } = useBook();
  const now = useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return (
    <AppShell title="更多">
      <div className="space-y-3">
        <p className="text-sm text-[var(--muted)]">
          管理帳本、帳戶、存款、分類與備份設定。
        </p>

        <ul className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          {LINKS.map((item, index) => (
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
                    {item.title}
                    {item.href === "/login" && user ? (
                      <span className="ml-2 text-xs font-normal text-[var(--accent)]">
                        已登入
                      </span>
                    ) : null}
                    {item.href === "/books" && book ? (
                      <span className="ml-2 text-xs font-normal text-[var(--accent)]">
                        {book.name}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {item.href === "/login" && !configured
                      ? "尚未設定雲端，可先本機使用"
                      : item.description}
                  </p>
                </div>
                <span className="text-[var(--muted)]" aria-hidden>
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <section className="space-y-2">
          <ExportCsvButton year={year} month={month} />
        </section>

        <BackupPanel />

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
          <p className="font-medium text-[var(--ink)]">帳本切換</p>
          <p className="mt-1 text-xs leading-relaxed">
            頁面上方隨時可以切換帳本，每本帳本的帳戶、分類、交易與預算完全分開。
          </p>
          <p className="mt-2 text-xs leading-relaxed">
            雲端與 Vercel 設定請看專案根目錄的{" "}
            <code className="text-[var(--ink)]">SETUP.md</code>。
          </p>
        </section>
      </div>
    </AppShell>
  );
}
