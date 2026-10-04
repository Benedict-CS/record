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
      className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3"
    >
      <p className="text-sm font-semibold text-[var(--ink)]">這個月還沒備份</p>
      <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
        下載一份 JSON，放在手機或電腦。換裝置時可以從「更多」匯入。
      </p>
      {error ? <p className="mt-1 text-xs text-rose-700">{error}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onDownload()}
          className="inline-flex min-h-11 items-center rounded-xl bg-[var(--ink)] px-3 text-sm font-semibold text-[var(--paper)] disabled:opacity-60"
        >
          {busy ? "下載中…" : "下載備份"}
        </button>
        <button
          type="button"
          onClick={() => markBackupDone()}
          className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm text-[var(--muted)]"
        >
          這個月先不用
        </button>
      </div>
    </section>
  );
}
