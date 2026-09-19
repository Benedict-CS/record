"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How often to poll for a newer worker while the app stays open. */
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

/**
 * Watches for a service worker that has installed but is still waiting, and
 * offers to activate it. The worker is generated with `skipWaiting: false`
 * (see next.config.ts), so it only takes over once we post SKIP_WAITING.
 *
 * Renders nothing when service workers are unsupported, on the very first
 * install (no controller yet) or while there is no pending update.
 */
export function PwaUpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [applying, setApplying] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const container = navigator.serviceWorker;
    const cleanups: Array<() => void> = [];
    let cancelled = false;

    // A waiting worker on a page that nothing controls yet is the first
    // install, not an update — don't nag about it.
    const offerIfWaiting = (registration: ServiceWorkerRegistration) => {
      if (cancelled || !container.controller) return;
      if (registration.waiting) setWaiting(registration.waiting);
    };

    const watch = (registration: ServiceWorkerRegistration) => {
      if (cancelled) return;
      offerIfWaiting(registration);

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed") offerIfWaiting(registration);
        });
      });

      const checkForUpdate = () => {
        if (document.visibilityState === "visible") {
          void registration.update().catch(() => {});
        }
      };
      document.addEventListener("visibilitychange", checkForUpdate);
      const interval = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
      cleanups.push(() => {
        document.removeEventListener("visibilitychange", checkForUpdate);
        window.clearInterval(interval);
      });
    };

    // Only reload for a controller swap we asked for, otherwise an update
    // activated in another tab would reload this one mid-entry.
    const onControllerChange = () => {
      if (!reloadingRef.current) return;
      reloadingRef.current = false;
      window.location.reload();
    };
    container.addEventListener("controllerchange", onControllerChange);

    container.ready.then(watch).catch(() => {});

    return () => {
      cancelled = true;
      container.removeEventListener("controllerchange", onControllerChange);
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    setApplying(true);
    reloadingRef.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
    // Safety net for browsers that never fire controllerchange here.
    window.setTimeout(() => {
      if (reloadingRef.current) {
        reloadingRef.current = false;
        window.location.reload();
      }
    }, 3000);
  }, [waiting]);

  if (!waiting || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 shadow-lg shadow-[rgba(28,43,36,0.12)]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--ink)]">有新版本</p>
        <p className="truncate text-xs text-[var(--muted)]">
          更新後會重新載入頁面
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-[var(--muted)]"
      >
        稍後
      </button>
      <button
        type="button"
        onClick={applyUpdate}
        disabled={applying}
        className="shrink-0 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--surface)] transition active:scale-[0.98] disabled:opacity-70"
      >
        {applying ? "更新中…" : "立即更新"}
      </button>
    </div>
  );
}
