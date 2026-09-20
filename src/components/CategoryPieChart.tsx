"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney, type MoneyCurrency } from "@/lib/format";
import type { CategoryBreakdownItem } from "@/lib/types";

export function CategoryPieChart({
  items,
  currency,
  emptyLabel = "此期間尚無分類資料",
  onSelect,
}: {
  items: CategoryBreakdownItem[];
  currency?: MoneyCurrency;
  emptyLabel?: string;
  /** Open category detail (same as tapping TOP ranking). */
  onSelect?: (item: CategoryBreakdownItem) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--muted)]">
        {emptyLabel}
      </p>
    );
  }

  function pickItem(index: number) {
    if (!onSelect) return;
    const item = items[index];
    if (item) onSelect(item);
  }

  return (
    <div className="space-y-3">
      {onSelect ? (
        <p className="text-[11px] text-[var(--muted)]">
          點圓餅或下方分類，可看這個期間每筆明細
        </p>
      ) : null}
      <div className="h-[220px] w-full sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="amount"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="42%"
              outerRadius="72%"
              paddingAngle={1.5}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
              style={onSelect ? { cursor: "pointer" } : undefined}
              onClick={(_, index) => pickItem(index)}
            >
              {items.map((item) => (
                <Cell
                  key={item.categoryId ?? item.name}
                  fill={item.color}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatMoney(Number(value ?? 0), currency)}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--ink)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const row = (
            <>
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden
                />
                <span className="truncate text-sm text-[var(--ink)]">
                  {item.name}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-right">
                <div>
                  <p className="text-sm font-medium text-[var(--ink)]">
                    {formatMoney(item.amount, currency)}
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">
                    {item.percent.toFixed(1)}%
                  </p>
                </div>
                {onSelect ? (
                  <span className="text-[var(--muted)]" aria-hidden>
                    ›
                  </span>
                ) : null}
              </div>
            </>
          );

          return (
            <li key={item.categoryId ?? item.name}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  aria-label={`查看 ${item.name} 明細`}
                  className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-left transition active:bg-[var(--paper)]"
                >
                  {row}
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
                  {row}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
