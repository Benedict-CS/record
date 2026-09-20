"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { ReminderNudge } from "@/components/ReminderNudge";
import { useToast } from "@/components/ToastProvider";
import {
  getNotificationPermission,
  getNotificationPermissionServerSnapshot,
  getReminderSettingsServerSnapshot,
  getReminderSettingsSnapshot,
  requestNotificationPermission,
  setReminderSettings,
  subscribeNotificationPermission,
  subscribeReminderSettings,
  type NotificationOutcome,
  type ReminderSettings,
} from "@/lib/reminder";

/** The time picker fires on every digit, so hold the toast back a moment. */
const SAVE_TOAST_DELAY = 700;

const LINKS: { href: string; title: string; description: string }[] = [
  { href: "/books", title: "帳本", description: "新增、切換與管理帳本" },
  { href: "/accounts", title: "帳戶", description: "現金、銀行與信用卡" },
  {
    href: "/holdings",
    title: "存款／資產",
    description: "現金、定存、基金、電子錢包",
  },
  { href: "/categories", title: "分類", description: "收入與支出分類與排序" },
  { href: "/templates", title: "範本", description: "常用記帳一鍵套用" },
  { href: "/budgets", title: "預算", description: "設定每月預算上限" },
];

const PERMISSION_LABEL: Record<NotificationOutcome, string> = {
  granted: "已允許",
  denied: "已封鎖",
  default: "尚未詢問",
  unsupported: "此瀏覽器不支援",
};

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
  // Both values live outside React (localStorage / the Notification API), so
  // they hydrate from the server snapshot and then swap to the real value.
  const settings = useSyncExternalStore(
    subscribeReminderSettings,
    getReminderSettingsSnapshot,
    getReminderSettingsServerSnapshot,
  );
  const permission = useSyncExternalStore(
    subscribeNotificationPermission,
    getNotificationPermission,
    getNotificationPermissionServerSnapshot,
  );
  const [requesting, setRequesting] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const save = useCallback(
    (next: ReminderSettings, message: string) => {
      setReminderSettings(next);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        show(message, { variant: "success" });
      }, SAVE_TOAST_DELAY);
    },
    [show],
  );

  function toggleEnabled() {
    const next = { ...settings, enabled: !settings.enabled };
    save(next, next.enabled ? `已開啟提醒（${next.time}）` : "已關閉記帳提醒");
  }

  function changeTime(time: string) {
    if (!time) return;
    save({ ...settings, time }, `提醒時間已改為 ${time}`);
  }

  async function askNotification() {
    setRequesting(true);
    try {
      const outcome = await requestNotificationPermission();
      if (outcome === "granted") {
        show("已開啟瀏覽器通知", { variant: "success" });
      } else if (outcome === "denied") {
        show("通知已被封鎖，請到瀏覽器設定開啟", { variant: "error" });
      } else if (outcome === "unsupported") {
        show("這個瀏覽器不支援通知", { variant: "error" });
      } else {
        show("尚未允許通知", { variant: "info" });
      }
    } finally {
      setRequesting(false);
    }
  }

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
    <AppShell title="設定">
      <div className="space-y-4">
        <ReminderNudge />

        {configured ? (
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <div className="border-b border-[var(--line)] px-4 py-3">
              <h2 className="text-sm font-medium text-[var(--ink)]">帳號與同步</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                登入後本機變更會同步到雲端；改密碼與登出在這裡。
              </p>
            </div>
            {user ? (
              <div className="space-y-3 px-4 py-3">
                <p className="break-all text-sm text-[var(--ink)]">
                  已登入：<span className="font-medium">{user.email}</span>
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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={settingPassword}
                      className="min-h-11 rounded-md border border-[var(--line)] px-4 text-sm font-medium text-[var(--ink)] disabled:opacity-60"
                    >
                      {settingPassword ? "設定中…" : "更新密碼"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onSignOut()}
                      className="min-h-11 rounded-md border border-[var(--line)] px-4 text-sm text-[var(--ink)]"
                    >
                      登出
                    </button>
                  </div>
                </form>
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

        <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="text-sm font-medium text-[var(--ink)]">記帳提醒</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
              到了設定時間還沒記帳，開啟 App 時會提醒你一次。
            </p>
          </div>

          <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
            <span
              id="reminder-toggle-label"
              className="text-sm text-[var(--ink)]"
            >
              每天提醒我
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              aria-labelledby="reminder-toggle-label"
              onClick={toggleEnabled}
              className={[
                "relative h-11 w-[4.5rem] shrink-0 rounded-full border transition-colors",
                settings.enabled
                  ? "border-[var(--accent)] bg-[var(--accent)]"
                  : "border-[var(--line)] bg-[var(--paper)]",
              ].join(" ")}
            >
              <span
                aria-hidden
                className={[
                  "absolute top-1 h-9 w-9 rounded-full bg-[var(--surface)] shadow-sm transition-[left]",
                  settings.enabled ? "left-8" : "left-1",
                ].join(" ")}
              />
            </button>
          </div>

          <div className="flex min-h-14 items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3">
            <label
              htmlFor="reminder-time"
              className="text-sm text-[var(--ink)]"
            >
              提醒時間
            </label>
            <input
              id="reminder-time"
              type="time"
              value={settings.time}
              disabled={!settings.enabled}
              onChange={(event) => changeTime(event.target.value)}
              className="min-h-11 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-base text-[var(--ink)] disabled:opacity-50"
            />
          </div>

          <div className="space-y-2 border-t border-[var(--line)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-[var(--ink)]">瀏覽器通知</span>
              <span className="text-xs text-[var(--muted)]">
                {PERMISSION_LABEL[permission]}
              </span>
            </div>
            <button
              type="button"
              onClick={askNotification}
              disabled={requesting || permission !== "default"}
              className="min-h-11 w-full rounded-xl bg-[var(--ink)] px-4 text-sm font-medium text-[var(--paper)] disabled:opacity-50"
            >
              啟用瀏覽器通知
            </button>
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              iOS 需要先把這個 App「加入主畫面」並從主畫面開啟，才能接收通知；
              在 Safari 分頁中無法啟用。即使不開通知，頁面上的提醒卡片仍會顯示。
            </p>
          </div>
        </section>

        <section>
          <h2 className="px-1 pb-2 text-sm font-medium text-[var(--ink)]">
            管理
          </h2>
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
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {item.description}
                    </p>
                  </div>
                  <span className="text-[var(--muted)]" aria-hidden>
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-medium text-[var(--ink)]">安裝成 App</h2>
          <ul className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-[var(--muted)]">
            <li>Chrome / Edge：網址列右側「安裝」或頁面上的「加入主畫面」。</li>
            <li>iPhone Safari：分享 → 加入主畫面。從主畫面開啟才是完整 PWA。</li>
            <li>安裝後可離線記帳；更新時會出現「有新版本」提示。</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-medium text-[var(--ink)]">關於</h2>
          <ul className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-[var(--muted)]">
            <li>資料存在本機（IndexedDB），離線也能記帳。</li>
            <li>登入後才會同步到雲端，未登入時只留在這台裝置。</li>
            <li>深色模式已停用，介面固定使用淺色。</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
