"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/** How often to poll for a newer worker while the app stays open. */
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

interface PwaUpdateState {
  updateReady: boolean;
  waitingWorker: ServiceWorker | null;
  dismissed: boolean;
}

let state: PwaUpdateState = {
  updateReady: false,
  waitingWorker: null,
  dismissed: false,
};

const listeners = new Set<() => void>();

function getSnapshot(): PwaUpdateState {
  return state;
}

function getServerSnapshot(): PwaUpdateState {
  return {
    updateReady: false,
    waitingWorker: null,
    dismissed: false,
  };
}

function emitChange(next: Partial<PwaUpdateState>) {
  state = { ...state, ...next };
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let initialized = false;
let reloading = false;
let hadInitialController = false;
let activeRegistration: ServiceWorkerRegistration | null = null;
let lastUpdateCheck = 0;

function initServiceWorkerListeners() {
  if (initialized || typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  initialized = true;

  const container = navigator.serviceWorker;
  // If the page was already controlled when loaded, hadInitialController is true.
  hadInitialController = Boolean(container.controller);

  const offerIfWaiting = (registration: ServiceWorkerRegistration) => {
    // A waiting worker on a page that was never controlled is part of first install,
    // not an update - do not nag about it.
    if (!hadInitialController && !container.controller) return;
    if (registration.waiting) {
      emitChange({ waitingWorker: registration.waiting, dismissed: false });
    }
  };

  const triggerUpdate = () => {
    const now = Date.now();
    // Throttle checks to avoid spamming
    if (now - lastUpdateCheck < 5000) return;
    lastUpdateCheck = now;

    if (activeRegistration) {
      void activeRegistration.update().catch(() => {});
    } else {
      container.getRegistration().then((reg) => {
        if (reg) {
          activeRegistration = reg;
          void reg.update().catch(() => {});
        }
      }).catch(() => {});
    }
  };

  const watchRegistration = (registration: ServiceWorkerRegistration) => {
    activeRegistration = registration;
    offerIfWaiting(registration);

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed") {
          offerIfWaiting(registration);
        }
      });
    });

    if (document.visibilityState === "visible") {
      void registration.update().catch(() => {});
    }
  };

  // Crucially, listen for controllerchange:
  container.addEventListener("controllerchange", () => {
    // If the reload was triggered explicitly by user tapping update:
    if (reloading) {
      reloading = false;
      window.location.reload();
      return;
    }

    // If this controller change is the initial install claiming the page for
    // the first time, do not reload or prompt the user.
    if (!hadInitialController) {
      hadInitialController = true;
      return;
    }

    // A newer service worker has activated in the background!
    // Offer reload without abruptly resetting any in-progress input.
    emitChange({
      updateReady: true,
      waitingWorker: null,
      dismissed: false,
    });
  });

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      triggerUpdate();
    }
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("focus", onVisibilityChange);
  window.setInterval(triggerUpdate, UPDATE_CHECK_INTERVAL);

  container.getRegistration().then((reg) => {
    if (reg) watchRegistration(reg);
  }).catch(() => {});

  container.ready.then((reg) => {
    watchRegistration(reg);
  }).catch(() => {});
}

/**
 * Watches for PWA service worker updates and prompts the user to reload.
 *
 * Handles both:
 * 1. Background activation (skipWaiting: true): When a new worker activates and
 *    claims the client, controllerchange fires. If the page was already controlled,
 *    we show "有新版本已就緒" with an "立即重新載入" button.
 * 2. Waiting worker (skipWaiting: false or delayed): When a worker is installed
 *    and waiting, we offer "有新版本" with an "立即更新" button.
 *
 * When reopening or switching back to the app, visibilitychange triggers
 * registration.update() to immediately check for newer builds.
 */
export function PwaUpdatePrompt() {
  const { updateReady, waitingWorker, dismissed } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    initServiceWorkerListeners();
  }, []);

  const handleReload = useCallback(() => {
    setApplying(true);
    window.location.reload();
  }, []);

  const handleApplyUpdate = useCallback(() => {
    if (updateReady) {
      handleReload();
      return;
    }
    if (!waitingWorker) return;
    setApplying(true);
    reloading = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });

    // Safety fallback in case the browser never fires controllerchange
    window.setTimeout(() => {
      if (reloading) {
        reloading = false;
        window.location.reload();
      }
    }, 3000);
  }, [updateReady, waitingWorker, handleReload]);

  const handleDismiss = useCallback(() => {
    emitChange({ dismissed: true });
  }, []);

  if (dismissed || (!updateReady && !waitingWorker)) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border border-[var(--accent)]/30 bg-[var(--surface)] p-3 shadow-lg shadow-[rgba(28,43,36,0.08)] ring-1 ring-[var(--accent)]/15 transition-all"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
          <svg
            className={`h-4.5 w-4.5 ${applying ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-[var(--ink)]">
            {updateReady ? "有新版本已就緒" : "有新版本"}
          </p>
          <p className="truncate text-xs text-[var(--muted)]">
            {updateReady
              ? "更新已完成，重新載入即可套用最新功能"
              : "更新後會重新載入頁面"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex min-h-[38px] items-center justify-center rounded-xl px-2.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)] active:scale-95"
        >
          稍後
        </button>
        <button
          type="button"
          onClick={handleApplyUpdate}
          disabled={applying}
          className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-[var(--accent)] px-3.5 text-xs font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-70"
        >
          {applying
            ? updateReady
              ? "重新載入中…"
              : "更新中…"
            : updateReady
              ? "立即重新載入"
              : "立即更新"}
        </button>
      </div>
    </aside>
  );
}
