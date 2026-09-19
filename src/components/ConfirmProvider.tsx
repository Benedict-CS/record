"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBodyScrollLock, useFocusTrap } from "@/components/BottomSheet";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const messageId = useId();

  const settle = useCallback((value: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setRequest(null);
    resolve?.(value);
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    // A second request supersedes the one on screen; the old caller gets false.
    resolveRef.current?.(false);
    setRequest(options);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const cancel = useCallback(() => settle(false), [settle]);

  useEffect(() => {
    return () => {
      resolveRef.current?.(false);
      resolveRef.current = null;
    };
  }, []);

  const open = request !== null;
  useBodyScrollLock(open);
  useFocusTrap(panelRef, open, cancel);

  const destructive = request?.destructive ?? false;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            aria-label={request.cancelLabel ?? "取消"}
            tabIndex={-1}
            className="absolute inset-0 bg-[var(--ink)]/45"
            onClick={cancel}
          />
          <div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={request.message ? messageId : undefined}
            tabIndex={-1}
            className="sheet-enter relative z-10 w-full max-w-lg rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] px-4 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl outline-none sm:max-w-sm sm:rounded-3xl sm:pb-5"
          >
            <h2
              id={titleId}
              className="text-lg font-semibold text-[var(--ink)]"
            >
              {request.title}
            </h2>
            {request.message ? (
              <p
                id={messageId}
                className="mt-2 text-sm leading-relaxed text-[var(--muted)]"
              >
                {request.message}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                data-autofocus={destructive ? undefined : true}
                onClick={() => settle(true)}
                className={[
                  "touch-target inline-flex flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white",
                  destructive
                    ? "bg-rose-600 active:bg-rose-700"
                    : "bg-[var(--accent)] active:bg-[var(--ink)]",
                ].join(" ")}
              >
                {request.confirmLabel ?? "確定"}
              </button>
              <button
                type="button"
                data-autofocus={destructive ? true : undefined}
                onClick={cancel}
                className="touch-target inline-flex flex-1 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--ink)] active:bg-[var(--paper)]"
              >
                {request.cancelLabel ?? "取消"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx;
}
