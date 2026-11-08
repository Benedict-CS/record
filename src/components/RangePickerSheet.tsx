"use client";

import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import {
  type CustomRange,
  type RangeMode,
  normalizeRange,
} from "@/lib/custom-range";
import { useLedgerEndYear } from "@/lib/hooks/useLedgerData";
import { LEDGER_START_YEAR, pickerYears } from "@/lib/period-jump";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function RangePickerSheet({
  open,
  range,
  onClose,
  onChange,
}: {
  open: boolean;
  range: CustomRange;
  onClose: () => void;
  onChange: (next: CustomRange) => void;
}) {
  const [draft, setDraft] = useState<CustomRange>(range);
  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth() + 1;
  const todayStr = `${nowYear}-${pad2(nowMonth)}-${pad2(new Date().getDate())}`;
  const endYear = useLedgerEndYear() ?? nowYear;
  const years = useMemo(
    () => pickerYears(draft.startYear, nowYear, endYear),
    [draft.startYear, nowYear, endYear],
  );

  function handleModeChange(mode: RangeMode) {
    setDraft((prev) => ({ ...prev, mode }));
  }

  function handleApply() {
    onChange(normalizeRange(draft));
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="選擇報表區間">
      <div className="space-y-4">
        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
          {(
            [
              { id: "month", label: "月份區間" },
              { id: "year", label: "年份區間" },
              { id: "date", label: "自選日期" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleModeChange(tab.id)}
              className={[
                "min-h-10 rounded-lg text-xs sm:text-sm font-medium transition",
                draft.mode === tab.id
                  ? "bg-[var(--ink)] text-[var(--paper)]"
                  : "text-[var(--muted)]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Month Mode */}
        {draft.mode === "month" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-[var(--muted)]">
                  開始月份
                </label>
                <div className="mt-1 flex gap-1.5">
                  <select
                    value={draft.startYear}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        startYear: Number(e.target.value),
                      }))
                    }
                    className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2 text-xs sm:text-sm text-[var(--ink)]"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y} 年
                      </option>
                    ))}
                  </select>
                  <select
                    value={draft.startMonth}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        startMonth: Number(e.target.value),
                      }))
                    }
                    className="min-h-11 w-20 shrink-0 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2 text-xs sm:text-sm text-[var(--ink)]"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m} 月
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--muted)]">
                  結束月份
                </label>
                <div className="mt-1 flex gap-1.5">
                  <select
                    value={draft.endYear}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        endYear: Number(e.target.value),
                      }))
                    }
                    className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2 text-xs sm:text-sm text-[var(--ink)]"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y} 年
                      </option>
                    ))}
                  </select>
                  <select
                    value={draft.endMonth}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        endMonth: Number(e.target.value),
                      }))
                    }
                    className="min-h-11 w-20 shrink-0 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2 text-xs sm:text-sm text-[var(--ink)]"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m} 月
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-[var(--muted)] mb-1.5">常用快捷</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: "今年 1–4 月",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        startYear: nowYear,
                        startMonth: 1,
                        endYear: nowYear,
                        endMonth: 4,
                      })),
                  },
                  {
                    label: "上半年 (1–6月)",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        startYear: nowYear,
                        startMonth: 1,
                        endYear: nowYear,
                        endMonth: 6,
                      })),
                  },
                  {
                    label: "下半年 (7–12月)",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        startYear: nowYear,
                        startMonth: 7,
                        endYear: nowYear,
                        endMonth: 12,
                      })),
                  },
                  {
                    label: "Q1",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        startYear: nowYear,
                        startMonth: 1,
                        endYear: nowYear,
                        endMonth: 3,
                      })),
                  },
                  {
                    label: "Q2",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        startYear: nowYear,
                        startMonth: 4,
                        endYear: nowYear,
                        endMonth: 6,
                      })),
                  },
                  {
                    label: "Q3",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        startYear: nowYear,
                        startMonth: 7,
                        endYear: nowYear,
                        endMonth: 9,
                      })),
                  },
                  {
                    label: "Q4",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        startYear: nowYear,
                        startMonth: 10,
                        endYear: nowYear,
                        endMonth: 12,
                      })),
                  },
                  {
                    label: "近 3 個月",
                    action: () => {
                      const startM = nowMonth >= 3 ? nowMonth - 2 : 12 + (nowMonth - 2);
                      const startY = nowMonth >= 3 ? nowYear : nowYear - 1;
                      setDraft((p) => ({
                        ...p,
                        startYear: startY,
                        startMonth: startM,
                        endYear: nowYear,
                        endMonth: nowMonth,
                      }));
                    },
                  },
                  {
                    label: "近 6 個月",
                    action: () => {
                      const startM = nowMonth >= 6 ? nowMonth - 5 : 12 + (nowMonth - 5);
                      const startY = nowMonth >= 6 ? nowYear : nowYear - 1;
                      setDraft((p) => ({
                        ...p,
                        startYear: startY,
                        startMonth: startM,
                        endYear: nowYear,
                        endMonth: nowMonth,
                      }));
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="min-h-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--ink)] active:bg-[var(--paper)]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Year Mode */}
        {draft.mode === "year" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-[var(--muted)]">
                  開始年份
                </label>
                <select
                  value={draft.startYear}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      startYear: Number(e.target.value),
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm text-[var(--ink)]"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y} 年
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--muted)]">
                  結束年份
                </label>
                <select
                  value={draft.endYear}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      endYear: Number(e.target.value),
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm text-[var(--ink)]"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y} 年
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="text-xs text-[var(--muted)] mb-1.5">常用快捷</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: "2021–2023 年",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        startYear: 2021,
                        endYear: 2023,
                      })),
                  },
                  {
                    label: "近 3 年",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        startYear: Math.max(LEDGER_START_YEAR, nowYear - 2),
                        endYear: nowYear,
                      })),
                  },
                  {
                    label: "近 5 年",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        startYear: Math.max(LEDGER_START_YEAR, nowYear - 4),
                        endYear: nowYear,
                      })),
                  },
                  {
                    label: "全部年份",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        startYear: LEDGER_START_YEAR,
                        endYear: endYear,
                      })),
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="min-h-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--ink)] active:bg-[var(--paper)]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Date Mode */}
        {draft.mode === "date" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-[var(--muted)]">
                  開始日期
                </label>
                <input
                  type="date"
                  value={draft.dateFrom}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, dateFrom: e.target.value }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2.5 text-xs sm:text-sm text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--muted)]">
                  結束日期
                </label>
                <input
                  type="date"
                  value={draft.dateTo}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, dateTo: e.target.value }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2.5 text-xs sm:text-sm text-[var(--ink)]"
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-[var(--muted)] mb-1.5">常用快捷</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: "近 30 天",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        dateFrom: daysAgo(30),
                        dateTo: todayStr,
                      })),
                  },
                  {
                    label: "近 90 天",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        dateFrom: daysAgo(90),
                        dateTo: todayStr,
                      })),
                  },
                  {
                    label: "今年至今",
                    action: () =>
                      setDraft((p) => ({
                        ...p,
                        dateFrom: `${nowYear}-01-01`,
                        dateTo: todayStr,
                      })),
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="min-h-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--ink)] active:bg-[var(--paper)]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleApply}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-semibold text-white shadow-sm transition active:opacity-90"
          >
            確定套用
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
