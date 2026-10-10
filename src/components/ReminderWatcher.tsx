"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { monthSummary } from "@/lib/db/crud";
import {
  useBudgets,
  useDateTransactionsQuery,
  useMonthTransactions,
  useSeedReady,
} from "@/lib/hooks/useLedgerData";
import { clampBudgetPct } from "@/lib/reminder-copy";
import {
  getReminderSettingsServerSnapshot,
  getReminderSettingsSnapshot,
  localDateKey,
  notifyIfDue,
  publishReminderClock,
  pullReminderFromCloud,
  registerDailyReminderSync,
  subscribeReminderSettings,
} from "@/lib/reminder";
import { syncPushSubscription } from "@/lib/push/cloud";

/** Re-check once a minute so a notification can fire after the chosen time. */
const TICK_MS = 60_000;

type Listener = () => void;

function subscribeMinuteClock(listener: Listener) {
  const tick = window.setInterval(listener, TICK_MS);
  document.addEventListener("visibilitychange", listener);
  return () => {
    window.clearInterval(tick);
    document.removeEventListener("visibilitychange", listener);
  };
}

function getMinuteClockSnapshot() {
  return Math.floor(Date.now() / TICK_MS);
}

function getMinuteClockServerSnapshot() {
  return 0;
}

/**
 * App-wide ticker. Lives in the shell so the daily notification is not
 * limited to the Settings page. Renders nothing.
 */
export function ReminderWatcher() {
  const ready = useSeedReady();
  const minuteBucket = useSyncExternalStore(
    subscribeMinuteClock,
    getMinuteClockSnapshot,
    getMinuteClockServerSnapshot,
  );
  const today = minuteBucket > 0 ? localDateKey(new Date()) : "";
  const year = today ? Number(today.slice(0, 4)) : 0;
  const month = today ? Number(today.slice(5, 7)) : 0;
  const { items, loading } = useDateTransactionsQuery(today);
  const monthTx = useMonthTransactions(year || 2000, month || 1, Boolean(today));
  const budgets = useBudgets(year || 2000, month || 1);
  const settings = useSyncExternalStore(
    subscribeReminderSettings,
    getReminderSettingsSnapshot,
    getReminderSettingsServerSnapshot,
  );
  const hasEntryToday = items.length > 0;
  const budgetUsedPct = useMemo(() => {
    const overall = budgets.find((row) => row.category_id == null && row.amount > 0);
    if (!overall) return null;
    return clampBudgetPct(monthSummary(monthTx).expense, overall.amount);
  }, [budgets, monthTx]);

  useEffect(() => {
    if (!ready) return;
    void pullReminderFromCloud();
    void syncPushSubscription();
  }, [ready, settings.enabled]);

  useEffect(() => {
    if (!ready || minuteBucket <= 0 || loading || !today) return;

    const now = new Date();
    void publishReminderClock({
      lastEntryDate: hasEntryToday ? today : null,
    });
    notifyIfDue(hasEntryToday, now, {
      todayCount: items.length,
      budgetUsedPct,
    });
    void registerDailyReminderSync();
  }, [
    ready,
    minuteBucket,
    loading,
    hasEntryToday,
    items.length,
    budgetUsedPct,
    today,
    settings.enabled,
    settings.time,
  ]);

  return null;
}
