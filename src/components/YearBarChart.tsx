"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, type MoneyCurrency } from "@/lib/format";

export type MonthlyTotal = {
  month: number;
  income: number;
  expense: number;
};

export function YearBarChart({
  months,
  currency,
  emptyLabel = "此年度尚無收支資料",
}: {
  months: MonthlyTotal[];
  currency?: MoneyCurrency;
  emptyLabel?: string;
}) {
  const hasData = months.some(
    (row) => row.income > 0 || row.expense > 0,
  );

  if (!hasData) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--muted)]">
        {emptyLabel}
      </p>
    );
  }

  const data = months.map((row) => ({
    ...row,
    label: `${row.month}月`,
  }));

  return (
    <div className="h-[240px] w-full sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, left: -12, bottom: 0 }}
          barGap={2}
          barCategoryGap="18%"
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
            interval={0}
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(value: number) =>
              value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
            }
          />
          <Tooltip
            formatter={(value, name) => [
              formatMoney(Number(value ?? 0), currency),
              name === "income" ? "收入" : "支出",
            ]}
            labelFormatter={(label) => String(label)}
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
          <Bar
            dataKey="income"
            name="income"
            fill="#34d399"
            radius={[3, 3, 0, 0]}
            maxBarSize={18}
          />
          <Bar
            dataKey="expense"
            name="expense"
            fill="#fb7185"
            radius={[3, 3, 0, 0]}
            maxBarSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
