import assert from "node:assert/strict";
import {
  defaultCustomRange,
  getRangeBounds,
  monthlyTotalsForRange,
  normalizeRange,
} from "./custom-range";
import type { Transaction } from "./types";

function mockTx(
  partial: Partial<Transaction> & Pick<Transaction, "date" | "amount" | "type">,
): Transaction {
  return {
    id: `tx-${Math.random()}`,
    user_id: null,
    client_id: "test",
    sync_status: "synced",
    book_id: "book-1",
    account_id: "acc-1",
    category_id: "cat-1",
    transfer_account_id: null,
    hold_status: null,
    release_transaction_id: null,
    reimbursable_amount: null,
    reimbursement_status: null,
    holding_id: null,
    tag: null,
    target_holding_id: null,
    receipt_path: null,
    splits: null,
    note: "",
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...partial,
  };
}

// 0. defaultCustomRange
{
  const def = defaultCustomRange(new Date("2026-05-15T00:00:00Z"));
  assert.equal(def.mode, "month");
  assert.equal(def.startYear, 2026);
  assert.equal(def.startMonth, 1);
  assert.equal(def.endYear, 2026);
  assert.equal(def.endMonth, 5);
}

// 1. normalizeRange
{
  const invertedMonth = normalizeRange({
    mode: "month",
    startYear: 2026,
    startMonth: 8,
    endYear: 2026,
    endMonth: 3,
    dateFrom: "",
    dateTo: "",
  });
  assert.equal(invertedMonth.startMonth, 3);
  assert.equal(invertedMonth.endMonth, 8);

  const invertedYear = normalizeRange({
    mode: "year",
    startYear: 2024,
    startMonth: 1,
    endYear: 2021,
    endMonth: 12,
    dateFrom: "",
    dateTo: "",
  });
  assert.equal(invertedYear.startYear, 2021);
  assert.equal(invertedYear.endYear, 2024);

  const invertedDate = normalizeRange({
    mode: "date",
    startYear: 2026,
    startMonth: 1,
    endYear: 2026,
    endMonth: 1,
    dateFrom: "2026-05-10",
    dateTo: "2026-02-01",
  });
  assert.equal(invertedDate.dateFrom, "2026-02-01");
  assert.equal(invertedDate.dateTo, "2026-05-10");
}

// 2. getRangeBounds for month range (e.g. 1-4月)
{
  const b = getRangeBounds({
    mode: "month",
    startYear: 2026,
    startMonth: 1,
    endYear: 2026,
    endMonth: 4,
    dateFrom: "",
    dateTo: "",
  });
  assert.equal(b.start, "2026-01-01");
  assert.equal(b.endExclusive, "2026-05-01");
  assert.equal(b.label, "2026 年 1–4 月");
}

// 3. getRangeBounds for month range ending in December
{
  const b = getRangeBounds({
    mode: "month",
    startYear: 2025,
    startMonth: 10,
    endYear: 2025,
    endMonth: 12,
    dateFrom: "",
    dateTo: "",
  });
  assert.equal(b.start, "2025-10-01");
  assert.equal(b.endExclusive, "2026-01-01");
  assert.equal(b.label, "2025 年 10–12 月");
}

// 4. getRangeBounds for multi-year month range
{
  const b = getRangeBounds({
    mode: "month",
    startYear: 2025,
    startMonth: 11,
    endYear: 2026,
    endMonth: 2,
    dateFrom: "",
    dateTo: "",
  });
  assert.equal(b.start, "2025-11-01");
  assert.equal(b.endExclusive, "2026-03-01");
  assert.equal(b.label, "2025 年 11 月 – 2026 年 2 月");
}

// 5. getRangeBounds for year range (e.g. 2021-2023)
{
  const b = getRangeBounds({
    mode: "year",
    startYear: 2021,
    startMonth: 1,
    endYear: 2023,
    endMonth: 12,
    dateFrom: "",
    dateTo: "",
  });
  assert.equal(b.start, "2021-01-01");
  assert.equal(b.endExclusive, "2024-01-01");
  assert.equal(b.label, "2021–2023 年");
}

// 6. getRangeBounds for single year
{
  const b = getRangeBounds({
    mode: "year",
    startYear: 2023,
    startMonth: 1,
    endYear: 2023,
    endMonth: 12,
    dateFrom: "",
    dateTo: "",
  });
  assert.equal(b.start, "2023-01-01");
  assert.equal(b.endExclusive, "2024-01-01");
  assert.equal(b.label, "2023 年");
}

// 7. monthlyTotalsForRange (1-4月)
{
  const txs: Transaction[] = [
    mockTx({ date: "2026-01-15", amount: 1000, type: "income" }),
    mockTx({ date: "2026-01-20", amount: 300, type: "expense" }),
    mockTx({ date: "2026-02-10", amount: 450, type: "expense" }),
    mockTx({ date: "2026-04-05", amount: 2000, type: "income" }),
    mockTx({ date: "2026-04-22", amount: 800, type: "expense" }),
  ];

  const totals = monthlyTotalsForRange(txs, 2026, 1, 2026, 4);
  assert.equal(totals.length, 4);
  assert.equal(totals[0].month, 1);
  assert.equal(totals[0].income, 1000);
  assert.equal(totals[0].expense, 300);

  assert.equal(totals[1].month, 2);
  assert.equal(totals[1].income, 0);
  assert.equal(totals[1].expense, 450);

  assert.equal(totals[2].month, 3);
  assert.equal(totals[2].income, 0);
  assert.equal(totals[2].expense, 0);

  assert.equal(totals[3].month, 4);
  assert.equal(totals[3].income, 2000);
  assert.equal(totals[3].expense, 800);
}

console.log("custom-range tests passed");
