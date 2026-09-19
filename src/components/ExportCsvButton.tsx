"use client";

import { useMemo, useState } from "react";
import { transactionsToCsv } from "@/lib/db/crud";
import {
  useAccounts,
  useCategories,
  useMonthTransactions,
  useYearTransactions,
} from "@/lib/hooks/useLedgerData";

type ExportScope = "month" | "year";

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExportCsvButton({
  year,
  month,
  className,
}: {
  year: number;
  month: number;
  className?: string;
}) {
  const [scope, setScope] = useState<ExportScope>("month");
  const accounts = useAccounts();
  const categories = useCategories();
  const monthTx = useMonthTransactions(year, month);
  const yearTx = useYearTransactions(year);

  const transactions = scope === "month" ? monthTx : yearTx;
  const label = useMemo(
    () =>
      scope === "month"
        ? `匯出 ${year}-${String(month).padStart(2, "0")} CSV`
        : `匯出 ${year} 年 CSV`,
    [scope, year, month],
  );

  function onExport() {
    const csv = transactionsToCsv(transactions, accounts, categories);
    const filename =
      scope === "month"
        ? `ledger-${year}-${String(month).padStart(2, "0")}.csv`
        : `ledger-${year}.csv`;
    downloadCsv(filename, csv);
  }

  return (
    <div
      className={[
        "space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4",
        className ?? "",
      ].join(" ")}
    >
      <p className="text-sm font-medium text-[var(--ink)]">匯出 CSV</p>
      <p className="text-xs text-[var(--muted)]">
        本機下載目前選擇範圍的交易明細，離線也能用。
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["month", "本月"],
            ["year", "本年"],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            onClick={() => setScope(value)}
            className={[
              "rounded-md px-2 py-2 text-sm",
              scope === value
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--paper)] text-[var(--muted)]",
            ].join(" ")}
          >
            {text}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onExport}
        disabled={transactions.length === 0}
        className="w-full rounded-md bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--paper)] disabled:opacity-50"
      >
        {transactions.length === 0 ? "沒有可匯出的紀錄" : label}
      </button>
    </div>
  );
}
