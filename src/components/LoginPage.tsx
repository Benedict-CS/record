"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

export function LoginPage() {
  const { user, loading, configured, signInWithEmail, signOut } = useAuth();
  const confirm = useConfirm();
  const { show } = useToast();
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);
    const result = await signInWithEmail(email.trim());
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      show(result.error, { variant: "error" });
      return;
    }
    setMessage("已寄出登入連結，請到信箱點擊完成登入。");
    show("已寄出登入連結", { variant: "success" });
  }

  async function onSignOut() {
    const ok = await confirm({
      title: "登出這個帳號？",
      message: "登出後仍可離線記帳，但變更不會再同步到雲端。",
      confirmLabel: "登出",
    });
    if (!ok) return;
    try {
      await signOut();
      show("已登出", { variant: "success" });
    } catch (caught) {
      show(
        caught instanceof Error && caught.message ? caught.message : "登出失敗",
        { variant: "error" },
      );
    }
  }

  return (
    <AppShell title="登入同步">
      <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        {!configured ? (
          <div className="space-y-2 text-sm text-[var(--muted)]">
            <p>尚未設定 Supabase，目前只能本機記帳。</p>
            <p>
              請在專案根目錄建立 <code>.env.local</code>，並參考 README 完成
              Vercel / Supabase 設定。
            </p>
            <Link
              href="/"
              className="touch-target inline-flex items-center text-[var(--accent)]"
            >
              返回記帳
            </Link>
          </div>
        ) : loading ? (
          <p className="text-sm text-[var(--muted)]" role="status">
            檢查登入狀態…
          </p>
        ) : user ? (
          <div className="space-y-3">
            <p className="text-sm break-all text-[var(--ink)]">
              已登入：<span className="font-medium">{user.email}</span>
            </p>
            <p className="text-sm text-[var(--muted)]">
              連線時會自動把本機變更同步到雲端，方便跨裝置使用。
            </p>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="touch-target inline-flex items-center justify-center rounded-md border border-[var(--line)] px-4 text-sm text-[var(--ink)]"
            >
              登出
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <p className="text-sm text-[var(--muted)]">
              使用 Email magic link 登入後，離線記下的資料會在上線時同步。
            </p>
            <div>
              <label
                htmlFor={emailId}
                className="mb-1 block text-xs text-[var(--muted)]"
              >
                Email
              </label>
              <input
                id={emailId}
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                enterKeyHint="send"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--accent)]"
                placeholder="you@example.com"
              />
            </div>
            {error ? (
              <p className="text-sm text-rose-600" role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="text-sm text-emerald-700" role="status">
                {message}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="min-h-12 w-full rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-[var(--paper)] disabled:opacity-60"
            >
              {submitting ? "寄送中…" : "寄送登入連結"}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
