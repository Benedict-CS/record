"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import {
  getSyncStatus,
  runSync,
  startSyncListeners,
  subscribeSyncStatus,
} from "@/lib/sync/engine";
import type { SyncUiStatus } from "@/lib/types";

const LABELS: Record<SyncUiStatus, string> = {
  offline: "離線",
  syncing: "同步中",
  synced: "已同步",
  error: "同步失敗",
  local: "僅本機",
};

const DOTS: Record<SyncUiStatus, string> = {
  offline: "bg-zinc-400",
  syncing: "bg-amber-500 animate-pulse",
  synced: "bg-emerald-600",
  error: "bg-rose-500",
  local: "bg-sky-500",
};

export function SyncBadge() {
  const [{ status, message }, setState] = useState(getSyncStatus());
  const [busy, setBusy] = useState(false);
  const { show } = useToast();

  useEffect(() => {
    const stop = startSyncListeners();
    const unsubscribe = subscribeSyncStatus((next, nextMessage) => {
      setState({ status: next, message: nextMessage });
    });
    return () => {
      stop();
      unsubscribe();
    };
  }, []);

  async function onSync() {
    if (busy) return;
    setBusy(true);
    try {
      await runSync();
      const result = getSyncStatus();
      if (result.status === "synced") {
        show("已同步到雲端", { variant: "success" });
      } else if (result.status === "error") {
        show(result.message ?? "同步失敗，請稍後再試", { variant: "error" });
      } else if (result.status === "offline") {
        show("目前離線，連線後會自動同步", { variant: "info" });
      } else {
        show(result.message ?? "僅本機模式，尚未登入同步", { variant: "info" });
      }
    } finally {
      setBusy(false);
    }
  }

  const detail = message ? `，${message}` : "";
  const shortError =
    status === "error" && message
      ? message.length > 28
        ? `${message.slice(0, 28)}…`
        : message
      : null;

  return (
    <button
      type="button"
      onClick={() => void onSync()}
      aria-label={`同步狀態：${LABELS[status]}${detail}。點擊立即同步`}
      aria-busy={status === "syncing" || busy}
      className={[
        "inline-flex min-h-11 max-w-[13rem] flex-col items-end justify-center rounded-xl border px-3 py-1.5 text-left active:bg-[var(--paper)]",
        status === "error"
          ? "border-rose-300 bg-rose-50 text-rose-800"
          : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]",
      ].join(" ")}
      title={message ?? LABELS[status]}
    >
      <span className="inline-flex items-center gap-2 text-xs font-medium">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOTS[status]}`}
          aria-hidden
        />
        <span aria-hidden>{busy ? "同步中" : LABELS[status]}</span>
      </span>
      {shortError ? (
        <span className="mt-0.5 max-w-full truncate text-[10px] leading-tight opacity-90">
          {shortError}
        </span>
      ) : null}
    </button>
  );
}
