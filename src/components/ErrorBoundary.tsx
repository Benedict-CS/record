"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  // Full document load so the broken subtree is rebuilt from scratch.
  private goHome = () => {
    window.location.href = new URL("/", window.location.origin).toString();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-4 py-12 pt-[max(3rem,env(safe-area-inset-top))]">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-2xl leading-none text-rose-600"
            aria-hidden
          >
            !
          </span>

          <h1 className="mt-4 text-xl font-semibold tracking-tight text-[var(--ink)]">
            畫面出了點問題
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            已記錄的資料仍安全地存在這台裝置上，重新載入通常就能繼續使用。
          </p>

          {error.message ? (
            <p className="mt-3 rounded-xl bg-[var(--paper)] px-3 py-2 text-xs break-words text-[var(--muted)]">
              {error.message}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={this.reload}
              className="touch-target inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--surface)] transition active:scale-[0.99]"
            >
              重新載入
            </button>
            <button
              type="button"
              onClick={this.goHome}
              className="touch-target inline-flex items-center justify-center rounded-xl border border-[var(--line)] px-4 text-sm text-[var(--ink)]"
            >
              回到記帳
            </button>
          </div>
        </div>
      </main>
    );
  }
}
