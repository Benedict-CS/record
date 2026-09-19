"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, type MoneyCurrency } from "@/lib/format";

export type TrendPoint = {
  /** Short, unique axis label (e.g. "5" for a day, "3月" for a month). */
  label: string;
  /** Longer label shown in the tooltip (e.g. "2026-09-05"). */
  fullLabel?: string;
  income: number;
  expense: number;
};

export function TrendLineChart({
  points,
  currency,
  showIncome = true,
  emptyLabel = "此期間尚無收支資料",
}: {
  points: TrendPoint[];
  currency?: MoneyCurrency;
  showIncome?: boolean;
  emptyLabel?: string;
}) {
  const hasData = points.some(
    (point) => point.expense > 0 || (showIncome && point.income > 0),
  );

  if (!hasData) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--muted)]">
        {emptyLabel}
      </p>
    );
  }

  // Axis labels are unique per period, so a plain map is enough for tooltips.
  const fullLabels = new Map(
    points.map((point) => [point.label, point.fullLabel ?? point.label]),
  );

  // Keep at most ~7 ticks so a 31-day month stays readable at 375px.
  const tickInterval = Math.max(0, Math.ceil(points.length / 7) - 1);

  return (
    <div className="h-[210px] w-full sm:h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 8, right: 8, left: -14, bottom: 0 }}
        >
          <CartesianGrid
            stroke="var(--line)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
            interval={tickInterval}
            minTickGap={4}
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={46}
            tickFormatter={(value: number) =>
              value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
            }
          />
          <Tooltip
            formatter={(value, name) => [
              formatMoney(Number(value ?? 0), currency),
              name === "income" ? "收入" : "支出",
            ]}
            labelFormatter={(label) =>
              fullLabels.get(String(label)) ?? String(label)
            }
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--ink)",
            }}
          />
          <Legend
            formatter={(value) => (value === "income" ? "收入" : "支出")}
            wrapperStyle={{ fontSize: 12, color: "var(--muted)" }}
          />
          <Line
            type="monotone"
            dataKey="expense"
            name="expense"
            stroke="#e11d48"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5 }}
          />
          {showIncome ? (
            <Line
              type="monotone"
              dataKey="income"
              name="income"
              stroke="#0f9d76"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3.5 }}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
