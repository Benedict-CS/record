"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

type Mode = "signin" | "signup";

export function LoginPage() {
  const {
    user,
    loading,
    configured,
    signInWithPassword,
    signUpWithPassword,
    setPassword,
    signOut,
  } = useAuth();
  const confirm = useConfirm();
  const { show } = useToast();
  const emailId = useId();
  const passwordId = useId();
  const newPasswordId = useId();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPasswordField] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);

    const trimmed = email.trim();
    const result =
      mode === "signin"
        ? await signInWithPassword(trimmed, password)
        : await signUpWithPassword(trimmed, password);

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      show(result.error, { variant: "error" });
      return;
    }

    if (mode === "signup" && "needsEmailConfirm" in result && result.needsEmailConfirm) {
      setMessage("註冊成功。若有開信箱驗證，請到信箱點連結後再登入。");
      show("請確認信箱後再登入", { variant: "success" });
      return;
    }

    show(mode === "signin" ? "登入成功" : "註冊並登入成功", {
      variant: "success",
    });
  }

  async function onSetPassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSettingPassword(true);
    const result = await setPassword(newPassword);
    setSettingPassword(false);
    if (result.error) {
      setError(result.error);
      show(result.error, { variant: "error" });
      return;
    }
    setNewPassword("");
    setMessage("密碼已設定，之後可用 Email + 密碼登入。");
    show("密碼已設定", { variant: "success" });
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
          <div className="space-y-4">
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

            <form
              onSubmit={onSetPassword}
              className="space-y-3 border-t border-[var(--line)] pt-4"
            >
              <p className="text-sm text-[var(--muted)]">
                若你是先前用寄信連結登入的，在這裡設一組密碼後，之後就不用再寄信。
              </p>
              <div>
                <label
                  htmlFor={newPasswordId}
                  className="mb-1 block text-xs text-[var(--muted)]"
                >
                  新密碼（至少 6 碼）
                </label>
                <input
                  id={newPasswordId}
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--accent)]"
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
                disabled={settingPassword}
                className="min-h-12 w-full rounded-md border border-[var(--line)] px-4 text-sm font-medium text-[var(--ink)] disabled:opacity-60"
              >
                {settingPassword ? "設定中…" : "設定／更新密碼"}
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setMessage(null);
                }}
                className={[
                  "min-h-10 flex-1 rounded-md px-3 text-sm font-medium",
                  mode === "signin"
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "border border-[var(--line)] text-[var(--ink)]",
                ].join(" ")}
              >
                登入
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setMessage(null);
                }}
                className={[
                  "min-h-10 flex-1 rounded-md px-3 text-sm font-medium",
                  mode === "signup"
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "border border-[var(--line)] text-[var(--ink)]",
                ].join(" ")}
              >
                註冊
              </button>
            </div>

            <p className="text-sm text-[var(--muted)]">
              用你自己的 Email 和密碼登入後，離線記下的資料會在上線時同步。與
              Google 無關。
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
                enterKeyHint="next"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--accent)]"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor={passwordId}
                className="mb-1 block text-xs text-[var(--muted)]"
              >
                密碼（至少 6 碼）
              </label>
              <input
                id={passwordId}
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                enterKeyHint="done"
                value={password}
                onChange={(event) => setPasswordField(event.target.value)}
                className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--accent)]"
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
              {submitting
                ? mode === "signin"
                  ? "登入中…"
                  : "註冊中…"
                : mode === "signin"
                  ? "登入"
                  : "註冊"}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
