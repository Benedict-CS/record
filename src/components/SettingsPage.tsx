"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { accountLabel } from "@/lib/account-name";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

export function SettingsPage() {
  const { show } = useToast();
  const confirm = useConfirm();
  const {
    user,
    configured,
    setPassword,
    signOut,
  } = useAuth();
  const newPasswordId = useId();
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [settingPassword, setSettingPassword] = useState(false);

  async function onSetPassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    setSettingPassword(true);
    const result = await setPassword(newPassword);
    setSettingPassword(false);
    if (result.error) {
      setPasswordError(result.error);
      show(result.error, { variant: "error" });
      return;
    }
    setNewPassword("");
    setPasswordMessage("密碼已更新。");
    show("密碼已更新", { variant: "success" });
  }

  async function onSignOut() {
    const ok = await confirm({
      title: "登出這個帳號？",
      message: "確定要登出嗎？登出後可隨時重新登入同步紀錄。",
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
    <AppShell title="帳號設定" backHref="/more">
      <div className="space-y-4">
        {configured ? (
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            {user ? (
              <div className="space-y-4 px-4 py-4">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <div>
                    <p className="text-xs text-[var(--muted)]">目前帳號</p>
                    <p className="mt-0.5 break-all text-sm font-semibold text-[var(--ink)]">
                      {accountLabel(user)}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    已連線同步
                  </span>
                </div>

                <form onSubmit={onSetPassword} className="space-y-3">
                  <div>
                    <label
                      htmlFor={newPasswordId}
                      className="mb-1 block text-xs font-medium text-[var(--muted)]"
                    >
                      修改新密碼（至少 6 碼）
                    </label>
                    <input
                      id={newPasswordId}
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="請輸入新密碼"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  {passwordError ? (
                    <p className="text-xs text-rose-600" role="alert">
                      {passwordError}
                    </p>
                  ) : null}
                  {passwordMessage ? (
                    <p className="text-xs text-emerald-700" role="status">
                      {passwordMessage}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={settingPassword}
                    className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 text-sm font-medium text-[var(--ink)] transition active:bg-[rgba(28,43,36,0.04)] disabled:opacity-60"
                  >
                    {settingPassword ? "設定中…" : "更新密碼"}
                  </button>
                </form>

                <div className="border-t border-[var(--line)] pt-3">
                  <button
                    type="button"
                    onClick={() => void onSignOut()}
                    className="min-h-11 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 transition active:bg-rose-100"
                  >
                    登出 {accountLabel(user)}
                  </button>
                  <div className="mt-2 text-center">
                    <Link
                      href="/delete-account"
                      className="inline-flex min-h-11 items-center text-xs text-rose-700/80 underline-offset-2 hover:underline"
                    >
                      刪除帳號
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 py-4">
                <p className="text-sm text-[var(--muted)]">
                  尚未登入，無法同步到雲端。
                </p>
                <Link
                  href="/login"
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--ink)] px-4 text-sm font-medium text-[var(--paper)]"
                >
                  去登入
                </Link>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
