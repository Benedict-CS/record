"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

const HOLD_MS = 480;

/** A step button. A short tap runs `onStep`; holding runs `onHold` once. */
export function HoldStepButton({
  ariaLabel,
  title,
  className,
  onStep,
  onHold,
  children,
}: {
  ariaLabel: string;
  title: string;
  className: string;
  onStep: () => void;
  onHold: () => void;
  children: ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  function clear() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function start(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    held.current = false;
    clear();
    event.currentTarget.setPointerCapture(event.pointerId);
    timer.current = setTimeout(() => {
      held.current = true;
      onHold();
    }, HOLD_MS);
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      className={className}
      onPointerDown={start}
      onPointerUp={clear}
      onPointerCancel={clear}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        onStep();
      }}
    >
      {children}
    </button>
  );
}
