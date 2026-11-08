"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BookSwitcher } from "@/components/BookSwitcher";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PwaUpdatePrompt } from "@/components/PwaUpdatePrompt";
import { QuickAddFab } from "@/components/QuickAddFab";
import { SyncBadge, SyncBootBanner } from "@/components/SyncBadge";
import { accountLabel } from "@/lib/account-name";
import { useAuth } from "@/components/AuthProvider";

const NAV = [
  { href: "/", label: "記帳", match: "exact" as const },
  { href: "/calendar", label: "日曆", match: "prefix" as const },
  { href: "/holdings", label: "存款", match: "prefix" as const },
  { href: "/reports", label: "報表", match: "prefix" as const },
  { href: "/more", label: "更多", match: "more" as const },
];

const MORE_PREFIXES = [
  "/more",
  "/today",
  "/accounts",
  "/categories",
  "/budgets",
  "/login",
  "/settings",
  "/books",
  "/templates",
  "/search",
  "/pending",
  "/recurring",
  "/privacy",
  "/delete-account",
];

function isActive(pathname: string, item: (typeof NAV)[number]) {
  if (item.match === "exact") return pathname === "/";
  if (item.match === "more") {
    return MORE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({
  children,
  title,
  backHref,
}: {
  children: ReactNode;
  title: string;
  backHref?: string;
}) {
  const pathname = usePathname();
  const { user, configured } = useAuth();
  const name = accountLabel(user);

  return (
    <div className="app-shell mx-auto flex min-h-full w-full max-w-lg flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <a
        href="#main-content"
        className="sr-only rounded-xl bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--accent)] focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        跳到主要內容
      </a>
      <header className="mb-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {backHref ? (
              <Link
                href={backHref}
                className="inline-flex min-h-6 items-center gap-0.5 text-xs font-medium text-[var(--accent)] hover:underline"
              >
                ‹ 返回
              </Link>
            ) : (
              <p className="text-[10px] tracking-[0.18em] text-[var(--muted)]">
                記帳本
              </p>
            )}
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-[var(--ink)] sm:text-2xl">
              {title}
            </h1>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              {pathname !== "/search" ? (
                <Link
                  href="/search"
                  aria-label="搜尋"
                  title="快速搜尋"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition hover:text-[var(--ink)] active:scale-95"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </Link>
              ) : null}
              <SyncBadge />
            </div>
            <Link
              href={user ? "/settings" : "/login"}
              aria-label={
                user
                  ? `帳號 ${name}，開啟帳號設定`
                  : configured
                    ? "開啟登入同步"
                    : "開啟設定說明"
              }
              className="inline-flex min-h-7 max-w-[10rem] items-center truncate px-1 text-xs text-[var(--accent)] underline-offset-2 hover:underline"
            >
              {name
                ? name
                : configured
                  ? "登入同步"
                  : "設定說明"}
            </Link>
          </div>
        </div>
        <BookSwitcher />
        <SyncBootBanner />
        <div className="space-y-2 empty:hidden">
          <PwaUpdatePrompt />
          <InstallPrompt />
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="app-shell-main flex-1 pb-[calc(var(--bottom-nav-height)+4.5rem+env(safe-area-inset-bottom))] outline-none"
      >
        {children}
      </main>

      <QuickAddFab />

      <nav
        className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur-md"
        aria-label="主要導覽"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 px-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 py-2 text-center text-[11px] leading-tight transition-colors sm:text-xs",
                  active
                    ? "font-semibold text-[var(--accent)]"
                    : "text-[var(--muted)] active:text-[var(--ink)]",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={[
                    "h-1 w-4 rounded-full transition-colors",
                    active ? "bg-[var(--accent)]" : "bg-transparent",
                  ].join(" ")}
                  aria-hidden
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}