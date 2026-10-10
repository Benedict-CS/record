"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useDateTransactionsQuery, useSeedReady } from "@/lib/hooks/useLedgerData";
import {
  getReminderSettingsServerSnapshot,
  getReminderSettingsSnapshot,
  localDateKey,
  notifyIfDue,
  publishReminderClock,
  registerDailyReminderSync,
  subscribeReminderSettings,
} from "@/lib/reminder";

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
  const { items, loading } = useDateTransactionsQuery(today);
  const settings = useSyncExternalStore(
    subscribeReminderSettings,
    getReminderSettingsSnapshot,
    getReminderSettingsServerSnapshot,
  );
  const hasEntryToday = items.length > 0;

  useEffect(() => {
    if (!ready || minuteBucket <= 0 || loading || !today) return;

    const now = new Date();
    void publishReminderClock({
      lastEntryDate: hasEntryToday ? today : null,
    });
    notifyIfDue(hasEntryToday, now);
    void registerDailyReminderSync();
  }, [
    ready,
    minuteBucket,
    loading,
    hasEntryToday,
    today,
    settings.enabled,
    settings.time,
  ]);

  return null;
}
