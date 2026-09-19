import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "找不到頁面 · 記帳本",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-4 py-12 pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--paper)] text-lg leading-none font-semibold text-[var(--accent)]"
          aria-hidden
        >
          404
        </span>

        <h1 className="mt-4 text-xl font-semibold tracking-tight text-[var(--ink)]">
          找不到這個頁面
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          這個網址可能已經變更或不存在，你的記帳資料不受影響。
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/"
            className="touch-target inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--surface)] transition active:scale-[0.99]"
          >
            回到記帳
          </Link>
          <Link
            href="/more"
            className="touch-target inline-flex items-center justify-center rounded-xl border border-[var(--line)] px-4 text-sm text-[var(--ink)]"
          >
            前往更多設定
          </Link>
        </div>
      </div>
    </main>
  );
}
