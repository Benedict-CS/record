"use client";

import { useEffect, useId, useState } from "react";
import {
  applyKey,
  evaluateExpression,
  formatCalcNumber,
  toAmountValue,
  type CalcKey,
} from "@/lib/calculator";

type AmountKeypadProps = {
  open: boolean;
  /** Seed expression when the sheet opens (e.g. existing amount). */
  initialExpression?: string;
  onConfirm: (amount: number) => void;
  onClose: () => void;
};

const OP_KEYS = new Set<CalcKey>(["+", "-", "*", "/", "equals"]);

const KEY_ROWS: Array<Array<{ key: CalcKey; label: string; wide?: boolean }>> = [
  [
    { key: "7", label: "7" },
    { key: "8", label: "8" },
    { key: "9", label: "9" },
    { key: "/", label: "÷" },
  ],
  [
    { key: "4", label: "4" },
    { key: "5", label: "5" },
    { key: "6", label: "6" },
    { key: "*", label: "×" },
  ],
  [
    { key: "1", label: "1" },
    { key: "2", label: "2" },
    { key: "3", label: "3" },
    { key: "-", label: "−" },
  ],
  [
    { key: "0", label: "0" },
    { key: ".", label: "." },
    { key: "backspace", label: "⌫" },
    { key: "+", label: "+" },
  ],
  [
    { key: "clear", label: "C" },
    { key: "equals", label: "=", wide: true },
  ],
];

function displayExpression(expression: string): string {
  return expression
    .replace(/\*/g, "×")
    .replace(/\//g, "÷")
    .replace(/-/g, "−");
}

export function AmountKeypad({
  open,
  initialExpression = "",
  onConfirm,
  onClose,
}: AmountKeypadProps) {
  const titleId = useId();
  const [expression, setExpression] = useState(initialExpression);
  // Remember the seed inputs so the expression can be re-seeded during render
  // rather than from an effect. Re-seeding fires whenever `open` flips or the
  // caller supplies a different expression, which is what the sheet needs so
  // that every time it opens it starts from the incoming value.
  const [seed, setSeed] = useState({ open, initialExpression });

  if (seed.open !== open || seed.initialExpression !== initialExpression) {
    setSeed({ open, initialExpression });
    if (open) {
      setExpression(initialExpression);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const live = evaluateExpression(expression);
  const liveLabel =
    live === null ? "—" : formatCalcNumber(Math.abs(live));

  function handleConfirm() {
    const amount = toAmountValue(expression);
    if (amount === null) return;
    onConfirm(amount);
  }

  function handleKey(key: CalcKey) {
    if (key === "equals") {
      const amount = toAmountValue(expression);
      if (amount !== null) {
        onConfirm(amount);
        return;
      }
      setExpression((prev) => applyKey(prev, key));
      return;
    }
    setExpression((prev) => applyKey(prev, key));
  }

  const canConfirm = toAmountValue(expression) !== null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="關閉金額鍵盤"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full rounded-t-2xl border border-[var(--line)] bg-[var(--surface)] shadow-lg"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h2 id={titleId} className="text-base font-medium text-[var(--ink)]">
            輸入金額
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-md px-3 text-sm text-[var(--muted)]"
          >
            關閉
          </button>
        </div>

        <div className="space-y-1 px-4 py-3">
          <p className="min-h-7 break-all text-right text-lg tabular-nums text-[var(--ink)]">
            {expression ? displayExpression(expression) : "0"}
          </p>
          <p className="text-right text-sm text-[var(--muted)]">
            結果{" "}
            <span className="font-semibold tabular-nums text-[var(--ink)]">
              {liveLabel}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 px-3 pb-2">
          {KEY_ROWS.flatMap((row) =>
            row.map(({ key, label, wide }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleKey(key)}
                className={[
                  "min-h-12 rounded-xl border border-[var(--line)] text-xl font-medium text-[var(--ink)] active:scale-[0.98]",
                  wide ? "col-span-3" : "",
                  key === "clear"
                    ? "bg-[var(--paper)] text-rose-700"
                    : OP_KEYS.has(key)
                      ? "bg-[var(--paper)] text-[var(--accent)]"
                      : "bg-[var(--paper)]",
                ].join(" ")}
              >
                {label}
              </button>
            )),
          )}
        </div>

        <div className="px-3 pb-2">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => handleConfirm()}
            className="min-h-12 w-full rounded-xl bg-[var(--accent)] text-base font-medium text-white disabled:opacity-50"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
