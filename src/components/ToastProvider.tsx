"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "success" | "error" | "info";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastOptions = {
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. */
  duration?: number;
  action?: ToastAction;
};

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
  leaving: boolean;
};

type ToastContextValue = {
  show: (message: string, options?: ToastOptions) => void;
};

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 2500;
/** Must stay in sync with the toast-out animation in globals.css. */
const EXIT_MS = 180;

const ToastContext = createContext<ToastContextValue | null>(null);

const DOT: Record<ToastVariant, string> = {
  success: "bg-emerald-600",
  error: "bg-rose-600",
  info: "bg-[var(--accent)]",
};

const ROLE_LABEL: Record<ToastVariant, string> = {
  success: "成功",
  error: "錯誤",
  info: "提示",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);

  const clearTimer = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const remove = useCallback(
    (id: number) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    },
    [clearTimer],
  );

  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      setToasts((prev) =>
        prev.map((toast) =>
          toast.id === id ? { ...toast, leaving: true } : toast,
        ),
      );
      const timer = setTimeout(() => remove(id), EXIT_MS);
      timers.current.set(id, timer);
    },
    [clearTimer, remove],
  );

  const show = useCallback(
    (message: string, options?: ToastOptions) => {
      const text = message.trim();
      if (!text) return;

      const id = nextId.current;
      nextId.current += 1;

      setToasts((prev) => {
        const next = [
          ...prev,
          {
            id,
            message: text,
            variant: options?.variant ?? "info",
            action: options?.action,
            leaving: false,
          },
        ];
        // Drop the oldest entries so the stack never grows past MAX_VISIBLE.
        const overflow = next.slice(0, Math.max(0, next.length - MAX_VISIBLE));
        overflow.forEach((toast) => clearTimer(toast.id));
        return next.slice(-MAX_VISIBLE);
      });

      const timer = setTimeout(
        () => dismiss(id),
        options?.duration ?? DEFAULT_DURATION,
      );
      timers.current.set(id, timer);
    },
    [clearTimer, dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="toast-viewport pointer-events-none fixed inset-x-0 z-[60] mx-auto flex w-full max-w-lg flex-col gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              "toast pointer-events-auto flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 shadow-lg shadow-black/5",
              toast.leaving ? "toast-leave" : "toast-enter",
            ].join(" ")}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${DOT[toast.variant]}`}
              aria-hidden
            />
            <span className="sr-only">{ROLE_LABEL[toast.variant]}：</span>
            <p className="min-w-0 flex-1 text-sm leading-snug text-[var(--ink)]">
              {toast.message}
            </p>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
                className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--paper)]"
              >
                {toast.action.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="關閉通知"
              className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base leading-none text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"
            >
              <span aria-hidden>✕</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
