"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DISMISS_KEY = "ledger:install-prompt-dismissed";
/** Chromium fires beforeinstallprompt right after load; wait before assuming iOS. */
const IOS_HINT_DELAY = 1500;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari predates display-mode and exposes its own flag.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as a Mac.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Chrome / Firefox on iOS cannot install to the home screen.
  return iOS && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Private mode / blocked storage: the hint simply comes back next visit.
  }
}

/**
 * Invites the user to install the app. Uses the native `beforeinstallprompt`
 * flow where available and falls back to describing iOS Safari's 分享 →
 * 加入主畫面 steps. Renders nothing when already installed or once dismissed.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<"native" | "ios" | null>(null);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || readDismissed()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      // Keep the event so the banner's button can open the native dialog.
      event.preventDefault();
      deferredRef.current = event as BeforeInstallPromptEvent;
      setMode("native");
    };

    const onInstalled = () => {
      deferredRef.current = null;
      setMode(null);
      writeDismissed();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS has no install event, so show the manual hint once instead.
    const timer = window.setTimeout(() => {
      if (!deferredRef.current && isIosSafari()) {
        setMode("ios");
        // One-time: showing it counts as seen.
        writeDismissed();
      }
    }, IOS_HINT_DELAY);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    setMode(null);
    writeDismissed();
  }, []);

  const install = useCallback(async () => {
    const deferred = deferredRef.current;
    if (!deferred) return;
    deferredRef.current = null;
    setMode(null);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      // Dialog already consumed or refused; nothing useful to recover.
    }
    // Either way the browser won't offer this event again for a while.
    writeDismissed();
  }, []);

  if (!mode) return null;

  return (
    <div
      className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 shadow-lg shadow-[rgba(28,43,36,0.12)]"
      role="complementary"
      aria-label="安裝提示"
    >
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-base leading-none text-[var(--surface)]"
        aria-hidden
      >
        $
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--ink)]">加入主畫面</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
          {mode === "ios"
            ? "點下方「分享」→ 選擇「加入主畫面」，即可全螢幕離線記帳。"
            : "安裝後可全螢幕開啟，離線也能記帳。"}
        </p>
        {mode === "native" ? (
          <button
            type="button"
            onClick={install}
            className="mt-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--surface)] transition active:scale-[0.98]"
          >
            立即加入
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="關閉安裝提示"
        className="shrink-0 rounded-lg px-2 py-1 text-base leading-none text-[var(--muted)]"
      >
        ×
      </button>
    </div>
  );
}
