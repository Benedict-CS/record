import {
  categoryBreakdown,
  csvCell,
  dailyTrend,
  groupTransactionsByDay,
  monthSummary,
  monthlyTotalsForYear,
  transactionsToCsv,
  yearlyTotals,
} from "./db/crud";
import type { Transaction } from "./types";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

function tx(
  patch: Partial<Transaction> &
    Pick<Transaction, "type" | "amount" | "date">,
): Transaction {
  return {
    id: crypto.randomUUID(),
    user_id: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    client_id: "test",
    sync_status: "synced",
    book_id: "b1",
    note: "",
    account_id: "a1",
    category_id: null,
    transfer_account_id: null,
    hold_status: null,
    release_transaction_id: null,
    reimbursable_amount: null,
    reimbursement_status: null,
    holding_id: null,
    tag: null,
    target_holding_id: null,
    ...patch,
  };
}

const releaseIncomeId = crypto.randomUUID();
const holdId = crypto.randomUUID();

const summary = monthSummary([
  tx({ type: "expense", amount: 100, date: "2026-08-01" }),
  tx({
    id: holdId,
    type: "hold",
    amount: 50,
    date: "2026-08-02",
    hold_status: "released",
    release_transaction_id: releaseIncomeId,
  }),
  tx({ type: "hold", amount: 20, date: "2026-08-03", hold_status: "held" }),
  tx({ type: "income", amount: 200, date: "2026-08-04" }),
  tx({
    id: releaseIncomeId,
    type: "income",
    amount: 50,
    date: "2026-08-05",
    note: "退回：宿舍押金",
  }),
]);

assert(summary.expense === 100, "expense excludes holds");
assert(summary.held === 70, "held includes released holds in-period");
assert(summary.heldOutstanding === 20, "heldOutstanding skips released holds");
assert(summary.outflow === 170, "outflow = selfPay + held");
assert(summary.income === 200, "release income excluded from income");
assert(summary.net === 100, "net ignores release refund income");
assert(summary.reimbursablePending === 0, "no pending reimbursable by default");
assert(summary.selfPay === 100, "selfPay equals expense when no reimbursable");

const withReimb = monthSummary([
  tx({
    type: "expense",
    amount: 1088,
    date: "2026-08-10",
    reimbursable_amount: 400,
    reimbursement_status: "pending",
  }),
  tx({
    type: "expense",
    amount: 500,
    date: "2026-08-11",
    reimbursable_amount: 100,
    reimbursement_status: "received",
  }),
]);
assert(withReimb.reimbursablePending === 400, "only pending reimbursable counted");
assert(withReimb.expense === 1588, "full expense still counted");
assert(withReimb.selfPay === 1488, "selfPay subtracts only received reimbursable");
assert(withReimb.outflow === 1488, "outflow follows selfPay when no holds");

const crossMonth = monthSummary([
  tx({
    type: "income",
    amount: 80,
    date: "2026-09-01",
    note: "退回：電費預繳",
  }),
  tx({ type: "income", amount: 10, date: "2026-09-02", note: "兼職" }),
]);
assert(crossMonth.income === 10, "cross-month release note excluded");

const years = yearlyTotals(
  [
    tx({ type: "income", amount: 10, date: "2020-05-01" }),
    tx({ type: "expense", amount: 4, date: "2026-01-02" }),
  ],
  2020,
  2026,
);
assert(years.length === 7 && years[0].year === 2020, "history spans every bookkeeping year");
assert(years[0].income === 10 && years[0].expense === 0, "2020 income is kept");
assert(years[1].income === 0 && years[1].expense === 0, "an empty year stays in the list");
assert(years[6].expense === 4 && years[6].year === 2026, "2026 expense is kept");

const refundYear = crypto.randomUUID();
const withRefund = yearlyTotals(
  [
    tx({ type: "income", amount: 100, date: "2024-03-01", note: "薪水" }),
    tx({
      id: refundYear,
      type: "income",
      amount: 40,
      date: "2024-04-01",
      note: "退回：押金",
    }),
    tx({
      type: "expense",
      amount: 80,
      date: "2024-05-01",
      reimbursable_amount: 30,
      reimbursement_status: "received",
    }),
  ],
  2024,
  2024,
);
assert(withRefund[0].income === 100, "hold refund is not counted as income");
assert(withRefund[0].expense === 50, "received reimbursement is taken out of spend");

// Every income aggregation must agree with monthSummary on hold refunds.
const linkedRefundId = crypto.randomUUID();
const mixed = [
  tx({ type: "income", amount: 300, date: "2026-03-05", note: "薪水", category_id: "c-salary" }),
  tx({
    type: "hold",
    amount: 120,
    date: "2026-03-06",
    hold_status: "released",
    release_transaction_id: linkedRefundId,
  }),
  tx({ id: linkedRefundId, type: "income", amount: 120, date: "2026-03-20", note: "押金" }),
  tx({ type: "income", amount: 80, date: "2026-04-02", note: "退回：電費預繳" }),
  tx({ type: "expense", amount: 50, date: "2026-04-03" }),
];
const months = monthlyTotalsForYear(mixed);
assert(months[2].income === 300, "year chart drops a linked refund (March)");
assert(months[3].income === 0, "year chart drops a note-prefixed refund (April)");
assert(months[3].expense === 50, "year chart keeps the expense");
const trend = dailyTrend(mixed);
assert(
  trend.find((point) => point.date === "2026-03-20")?.income === 0,
  "daily trend drops a linked refund",
);
assert(
  trend.find((point) => point.date === "2026-04-02")?.income === 0,
  "daily trend drops a note-prefixed refund",
);
const incomeByCategory = categoryBreakdown(mixed, [], "income");
assert(
  incomeByCategory.length === 1 && incomeByCategory[0].amount === 300,
  "income breakdown has no 未分類 bucket from refunds",
);
assert(
  monthSummary(mixed).income === months.reduce((sum, row) => sum + row.income, 0),
  "monthly chart income sums to the summary income",
);

const dayBuckets = groupTransactionsByDay(mixed);
const march20 = dayBuckets.find((bucket) => bucket.date === "2026-03-20");
assert(march20?.income === 0, "calendar day income skips a linked refund");

const quoted = csvCell('午餐, "特餐"');
assert(quoted === '"午餐, ""特餐"""', "csv cells quote commas and inner quotes");
const csv = transactionsToCsv(
  [tx({ type: "expense", amount: 10, date: "2026-01-01", note: "a,b" })],
  [],
  [],
);
assert(csv.includes('"a,b"'), "notes with commas stay in one column");
assert(csv.includes("hold_status"), "csv includes hold and reimbursement columns");

console.log("month-summary tests passed");
