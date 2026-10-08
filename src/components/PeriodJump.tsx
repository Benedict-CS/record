"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { pickerYears } from "@/lib/period-jump";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function PeriodJump({
  year,
  month,
  scope = "month",
  onChange,
  className,
}: {
  year: number;
  month: number;
  scope?: "month" | "year";
  onChange: (year: number, month: number) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(year);
  const nowYear = new Date().getFullYear();
  const years = pickerYears(open ? draftYear : year, nowYear);
  const label = scope === "year" ? `${year} 年` : `${year} 年 ${month} 月`;

  function openSheet() {
    setDraftYear(year);
    setOpen(true);
  }

  function pickYear(next: number) {
    if (scope === "year") {
      onChange(next, month);
      setOpen(false);
      return;
    }
    setDraftYear(next);
  }

  function pickMonth(nextMonth: number) {
    onChange(draftYear, nextMonth);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`選擇${scope === "year" ? "年份" : "年月"}，目前${label}`}
        className={
          className ??
          "text-sm font-semibold tracking-wide tabular-nums text-[var(--ink)]"
        }
      >
        {label}
        <span className="ml-1 text-[10px] opacity-70" aria-hidden>
          ▾
        </span>
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={scope === "year" ? "跳到某一年" : "跳到某個月"}
      >
        <div className="flex flex-wrap gap-1.5">
          {years.map((option) => {
            const selected = option === (scope === "year" ? year : draftYear);
            return (
              <button
                key={option}
                type="button"
                data-autofocus={selected ? true : undefined}
                aria-pressed={selected}
                onClick={() => pickYear(option)}
                className={[
                  "min-h-10 rounded-xl px-3 text-sm font-medium tabular-nums",
                  selected
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "border border-[var(--line)] text-[var(--ink)]",
                ].join(" ")}
              >
                {option}
              </button>
            );
          })}
        </div>
        {scope === "month" ? (
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {MONTHS.map((option) => {
              const selected = draftYear === year && option === month;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pickMonth(option)}
                  className={[
                    "min-h-11 rounded-xl text-sm font-medium",
                    selected
                      ? "bg-[var(--accent)] text-[var(--surface)]"
                      : "border border-[var(--line)] text-[var(--ink)]",
                  ].join(" ")}
                >
                  {option} 月
                </button>
              );
            })}
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}
