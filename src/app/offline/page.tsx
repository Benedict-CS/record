"use client";

import Link from "next/link";

// Precached by next-pwa and served as the document fallback when a navigation
// misses both the cache and the network. Client component so 重新載入 can retry
// the originally requested URL instead of navigating to /offline.

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-4 py-12 pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)] text-2xl leading-none text-[var(--surface)]"
          aria-hidden
        >
          $
        </span>

        <h1 className="mt-4 text-xl font-semibold tracking-tight text-[var(--ink)]">
          目前離線
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          已記錄的資料仍可查看，連線後會自動同步。
        </p>

        <ul className="mt-4 space-y-1.5 text-sm text-[var(--muted)]">
          <li>・這次要開啟的頁面還沒有離線副本。</li>
          <li>・現在新增的記帳會先存在裝置上。</li>
        </ul>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="touch-target inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--surface)] transition active:scale-[0.99]"
          >
            重新載入
          </button>
          <Link
            href="/"
            className="touch-target inline-flex items-center justify-center rounded-xl border border-[var(--line)] px-4 text-sm text-[var(--ink)]"
          >
            回到首頁
          </Link>
        </div>
      </div>

      <p className="mt-4 px-1 text-xs text-[var(--muted)]">
        記帳本可離線使用，連上網路後會自動重試同步。
      </p>
    </main>
  );
}
