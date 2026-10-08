"use client";

import { useState, useSyncExternalStore } from "react";
import { exportBackup } from "@/lib/db/backup";
import {
  getBackupDoneServerSnapshot,
  getBackupDoneSnapshot,
  markBackupDone,
  shouldRemindBackup,
  subscribeBackupDone,
} from "@/lib/backup-nudge";
import { todayLocal } from "@/lib/format";

function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Home card until this month's JSON backup is downloaded or dismissed. */
export function BackupNudge() {
  const doneMonth = useSyncExternalStore(
    subscribeBackupDone,
    getBackupDoneSnapshot,
    getBackupDoneServerSnapshot,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!shouldRemindBackup(doneMonth)) return null;

  async function onDownload() {
    setBusy(true);
    setError(null);
    try {
      const json = await exportBackup();
      downloadJson(`記帳備份-${todayLocal()}.json`, json);
      markBackupDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "匯出失敗，請再試一次。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="每月備份"
      className="flex min-h-11 min-w-0 flex-1 items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-2.5"
    >
      <p className={`min-w-0 flex-1 truncate text-sm ${error ? "text-rose-700" : "text-[var(--ink)]"}`}>
        {error ?? "還沒備份"}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onDownload()}
        className="inline-flex min-h-10 shrink-0 items-center rounded-xl px-2 text-sm font-semibold text-[var(--accent)] disabled:opacity-60"
      >
        {busy ? "下載中…" : "下載"}
      </button>
      <button
        type="button"
        onClick={() => markBackupDone()}
        aria-label="這個月先不用"
        className="inline-flex min-h-10 shrink-0 items-center rounded-xl px-2 text-sm text-[var(--muted)]"
      >
        ×
      </button>
    </section>
  );
}
