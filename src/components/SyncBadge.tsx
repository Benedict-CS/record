"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
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
  error: "有衝突",
  local: "僅本機",
};

const DOTS: Record<SyncUiStatus, string> = {
  offline: "bg-zinc-500",
  syncing: "bg-amber-500 animate-pulse",
  synced: "bg-emerald-600",
  error: "bg-rose-500",
  local: "bg-sky-500",
};

const FIRST_SYNC_KEY = "ledger_cloud_boot_done";

export function SyncBadge() {
  const [{ status, message }, setState] = useState(getSyncStatus());
  const [busy, setBusy] = useState(false);
  const { show } = useToast();

  useEffect(() => {
    const stop = startSyncListeners();
    const unsubscribe = subscribeSyncStatus((next, nextMessage) => {
      setState({ status: next, message: nextMessage });
      if (next === "synced" && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(FIRST_SYNC_KEY, "1");
      }
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
        show(result.message ?? "同步有衝突，請再試一次", { variant: "error" });
      } else if (result.status === "offline") {
        show("目前離線，連線後會自動同步", { variant: "info" });
      } else {
        show(result.message ?? "僅本機模式，尚未登入同步", { variant: "info" });
      }
    } finally {
      setBusy(false);
    }
  }

  const label = busy || status === "syncing" ? "同步中" : LABELS[status];
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
      aria-label={`同步狀態：${label}${detail}。點擊立即同步`}
      aria-busy={status === "syncing" || busy}
      className={[
        "inline-flex min-h-11 max-w-[13rem] flex-col items-end justify-center rounded-xl border px-3 py-1.5 text-left active:bg-[var(--paper)]",
        status === "error"
          ? "border-rose-300 bg-rose-50 text-rose-800"
          : status === "offline"
            ? "border-zinc-300 bg-zinc-100 text-zinc-800"
            : status === "syncing" || busy
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]",
      ].join(" ")}
      title={message ?? LABELS[status]}
    >
      <span className="inline-flex items-center gap-2 text-xs font-medium">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            busy ? DOTS.syncing : DOTS[status]
          }`}
          aria-hidden
        />
        <span aria-hidden>{label}</span>
      </span>
      {shortError ? (
        <span className="mt-0.5 max-w-full truncate text-[10px] leading-tight opacity-90">
          {shortError}
        </span>
      ) : null}
    </button>
  );
}

/** Banner under the header: first cloud pull, offline, or sync error + retry. */
export function SyncBootBanner() {
  const { user } = useAuth();
  const [{ status, message }, setState] = useState(getSyncStatus());
  const [bootDone, setBootDone] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(FIRST_SYNC_KEY) === "1";
  });
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    return subscribeSyncStatus((next, nextMessage) => {
      setState({ status: next, message: nextMessage });
      if (next === "synced") {
        sessionStorage.setItem(FIRST_SYNC_KEY, "1");
        setBootDone(true);
      }
    });
  }, []);

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await runSync();
    } finally {
      setRetrying(false);
    }
  }

  if (status === "offline") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-xs leading-relaxed text-zinc-800"
      >
        <p className="font-medium">目前離線</p>
        <p className="mt-0.5 text-zinc-600">
          本機仍可記帳；連上網後會自動同步到雲端。
        </p>
      </div>
    );
  }

  if (!user) return null;

  if (status === "syncing" && !bootDone) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950"
      >
        正在載入雲端資料… 請稍候，同步完成後明細會自動出現。
      </p>
    );
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-900"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium">同步失敗</p>
          <p className="mt-0.5 text-rose-800/90">
            {message ?? "請檢查網路後再試。本機資料不會丟。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void retry()}
          disabled={retrying}
          className="shrink-0 rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {retrying ? "重試中…" : "重試"}
        </button>
      </div>
    );
  }

  return null;
}
