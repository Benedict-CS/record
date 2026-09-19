"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

let scrollLockCount = 0;
let previousBodyOverflow = "";

/** Locks body scroll while any modal surface is open (nesting-safe). */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (scrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    scrollLockCount += 1;
    return () => {
      scrollLockCount -= 1;
      if (scrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
    };
  }, [active]);
}

/**
 * Keeps Tab focus inside the container, closes on Escape and restores focus to
 * the trigger on unmount. Elements marked `data-autofocus` win the first focus.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void,
) {
  const escapeRef = useRef(onEscape);

  useEffect(() => {
    escapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const preferred = container.querySelector<HTMLElement>("[data-autofocus]");
    const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE);
    (preferred ?? firstFocusable ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        escapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const items = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [containerRef, active]);
}

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  leading,
  closeLabel = "關閉",
  children,
  footer,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** Decorative node shown before the title, e.g. a preview icon. */
  leading?: ReactNode;
  closeLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);

  useBodyScrollLock(open);
  useFocusTrap(sheetRef, open, close);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label={closeLabel}
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--ink)]/40"
        onClick={close}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="sheet-enter relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] shadow-xl outline-none"
      >
        {title ? (
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
            {leading ? <div className="shrink-0">{leading}</div> : null}
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className="truncate text-lg font-semibold text-[var(--ink)]"
              >
                {title}
              </h2>
              {description ? (
                <p
                  id={descriptionId}
                  className="mt-0.5 text-xs text-[var(--muted)]"
                >
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={closeLabel}
              className="touch-target -mr-1 flex shrink-0 items-center justify-center rounded-full px-3 text-sm text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"
            >
              {closeLabel}
            </button>
          </div>
        ) : null}

        <div
          className={
            bodyClassName ??
            [
              "min-h-0 flex-1 overflow-y-auto px-4 py-4",
              // The footer already carries the safe-area padding when present.
              footer ? "" : "pb-[max(1rem,env(safe-area-inset-bottom))]",
            ].join(" ")
          }
        >
          {children}
        </div>

        {footer ? (
          <div className="border-t border-[var(--line)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
