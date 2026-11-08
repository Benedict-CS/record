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
      message:
        "登出後看到的是這台裝置自己的帳，可以繼續離線記。那些紀錄不會同步到雲端，也不會在下次登入別的帳號時被上傳。",
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
    <AppShell title="設定">
      <div className="space-y-4">
        {configured ? (
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <div className="border-b border-[var(--line)] px-4 py-3">
              <h2 className="text-sm font-medium text-[var(--ink)]">帳號與同步</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                登入後，只有這個帳號的紀錄會和雲端同步。未登入時記的帳留在這台裝置，不會被下一個登入的帳號帶走。
              </p>
            </div>
            {user ? (
              <div className="space-y-3 px-4 py-3">
                <p className="break-all text-sm text-[var(--ink)]">
                  已登入：<span className="font-medium">{accountLabel(user)}</span>
                </p>
                <form onSubmit={onSetPassword} className="space-y-3">
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
                  {passwordError ? (
                    <p className="text-sm text-rose-600" role="alert">
                      {passwordError}
                    </p>
                  ) : null}
                  {passwordMessage ? (
                    <p className="text-sm text-emerald-700" role="status">
                      {passwordMessage}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={settingPassword}
                    className="min-h-11 rounded-md border border-[var(--line)] px-4 text-sm font-medium text-[var(--ink)] disabled:opacity-60"
                  >
                    {settingPassword ? "設定中…" : "更新密碼"}
                  </button>
                </form>
                <div className="border-t border-[var(--line)] pt-3">
                  <p className="text-xs leading-relaxed text-[var(--muted)]">
                    登出後回到這台自己的帳。上一個帳號的紀錄留在那個帳號，不會在你改登別的帳號時被上傳。
                  </p>
                  <button
                    type="button"
                    onClick={() => void onSignOut()}
                    className="mt-3 min-h-11 w-full rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-800"
                  >
                    登出 {accountLabel(user)}
                  </button>
                  <Link
                    href="/delete-account"
                    className="mt-2 inline-flex min-h-11 items-center text-sm text-rose-800 underline-offset-2 hover:underline"
                  >
                    刪除帳號
                  </Link>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3">
                <p className="text-sm text-[var(--muted)]">
                  尚未登入，無法同步到雲端。
                </p>
                <Link
                  href="/login"
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-[var(--paper)]"
                >
                  去登入
                </Link>
              </div>
            )}
          </section>
        ) : null}

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-medium text-[var(--ink)]">安裝成 App</h2>
          <ul className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-[var(--muted)]">
            <li>Chrome / Edge：網址列右側「安裝」或頁面上的「加入主畫面」。</li>
            <li>iPhone Safari：分享 → 加入主畫面。從主畫面開啟才是完整 PWA。</li>
            <li>安裝後可離線記帳；新版本會自動套用，下次開啟即可看到。</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-medium text-[var(--ink)]">關於</h2>
          <ul className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-[var(--muted)]">
            <li>資料存在本機（IndexedDB），離線也能記帳。</li>
            <li>登入後才會同步到雲端，未登入時只留在這台裝置。</li>
            <li>
              <Link
                href="/privacy"
                className="text-[var(--accent)] underline-offset-2 hover:underline"
              >
                隱私權說明
              </Link>
            </li>
            <li>深色模式已停用，介面固定使用淺色。</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
