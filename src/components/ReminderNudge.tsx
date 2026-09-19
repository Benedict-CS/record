"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { todayLocal } from "@/lib/format";
import { useDateTransactions, useSeedReady } from "@/lib/hooks/useLedgerData";
import {
  dismissNudgeForToday,
  getReminderSettingsServerSnapshot,
  getReminderSettingsSnapshot,
  notifyIfDue,
  shouldNudgeToday,
  subscribeReminderSettings,
} from "@/lib/reminder";

/** Wait for the local query to resolve so the card never flashes on load. */
const SETTLE_MS = 700;
/** Re-check once a minute so the card appears when the reminder time passes. */
const TICK_MS = 60_000;

/**
 * Inline reminder card. Renders nothing unless reminders are enabled, the
 * configured time has passed and nothing was recorded today.
 */
export function ReminderNudge() {
  const ready = useSeedReady();
  const today = todayLocal();
  const transactions = useDateTransactions(today);
  const hasEntryToday = transactions.length > 0;
  // Subscribed so toggling the setting elsewhere updates the card right away.
  const settings = useSyncExternalStore(
    subscribeReminderSettings,
    getReminderSettingsSnapshot,
    getReminderSettingsServerSnapshot,
  );

  // `null` until the first client tick, which also keeps SSR output empty.
  const [now, setNow] = useState<Date | null>(null);
  // Compared against today's date so a new day brings the card back.
  const [dismissedOn, setDismissedOn] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const settle = window.setTimeout(() => setNow(new Date()), SETTLE_MS);
    const tick = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => {
      window.clearTimeout(settle);
      window.clearInterval(tick);
    };
  }, [ready]);

  const visible =
    now !== null &&
    settings.enabled &&
    dismissedOn !== today &&
    shouldNudgeToday(hasEntryToday, now);

  useEffect(() => {
    if (!visible) return;
    notifyIfDue(hasEntryToday);
  }, [visible, hasEntryToday]);

  const dismiss = useCallback(() => {
    dismissNudgeForToday();
    setDismissedOn(todayLocal());
  }, []);

  if (!visible) return null;

  return (
    <section
      aria-label="記帳提醒"
      className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3"
    >
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-base leading-none text-[var(--surface)]"
        aria-hidden
      >
        !
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--ink)]">今天還沒記帳</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
          花十秒補上今天的花費，月底報表才會準。
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--surface)] active:scale-[0.98]"
          >
            現在記一筆
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm text-[var(--muted)] active:bg-[var(--paper)]"
          >
            今天不再提醒
          </button>
        </div>
      </div>
    </section>
  );
}
