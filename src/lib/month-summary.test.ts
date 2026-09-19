import { monthSummary } from "./db/crud";
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
assert(summary.outflow === 170, "outflow = expense + held");
assert(summary.income === 200, "release income excluded from income");
assert(summary.net === 100, "net ignores release refund income");

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

console.log("month-summary tests passed");
