import { expenseDisplayAmount } from "./reimbursement";
import { categoryBreakdown, monthSummary } from "./db/crud";
import type { Category, Transaction } from "./types";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

function tx(
  patch: Partial<Transaction> & Pick<Transaction, "type" | "amount" | "date">,
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
    category_id: "c-shop",
    transfer_account_id: null,
    hold_status: null,
    release_transaction_id: null,
    reimbursable_amount: null,
    reimbursement_status: null,
    ...patch,
  };
}

// Gym: pending shows full cash; after 銷帳 shows self-pay.
const gymPending = tx({
  type: "expense",
  amount: 1088,
  date: "2026-09-01",
  category_id: "c-sport",
  reimbursable_amount: 400,
  reimbursement_status: "pending",
});
const gymReceived = {
  ...gymPending,
  id: crypto.randomUUID(),
  reimbursement_status: "received" as const,
};

assert(expenseDisplayAmount(gymPending) === 1088, "pending display = cash");
assert(expenseDisplayAmount(gymReceived) === 688, "received display = self-pay");

// Dehumidifier day header: 花 must sum display amounts.
const dayRows = [
  tx({ type: "expense", amount: 78, date: "2026-08-08", category_id: "c-bf" }),
  tx({ type: "expense", amount: 36, date: "2026-08-08", category_id: "c-bf" }),
  tx({ type: "expense", amount: 78, date: "2026-08-08", category_id: "c-bf" }),
  tx({ type: "expense", amount: 88, date: "2026-08-08", category_id: "c-lunch" }),
  tx({ type: "expense", amount: 89, date: "2026-08-08", category_id: "c-dinner" }),
  tx({
    type: "expense",
    amount: 7666,
    date: "2026-08-08",
    category_id: "c-shop",
    reimbursable_amount: 900,
    reimbursement_status: "received",
  }),
];
const daySpend = dayRows.reduce((s, row) => s + expenseDisplayAmount(row), 0);
assert(daySpend === 7135, `day 花 = 7135, got ${daySpend}`);

const summary = monthSummary([
  ...dayRows,
  tx({ type: "income", amount: 50000, date: "2026-08-25", category_id: "c-salary" }),
  tx({
    type: "income",
    amount: 400,
    date: "2026-08-25",
    category_id: "c-subsidy",
    note: "健身房補助",
  }),
]);
assert(summary.expense === 8035, "cash expense keeps 7666");
assert(summary.selfPay === 7135, "selfPay after 銷帳");
assert(summary.outflow === 7135, "花費 follows selfPay");
assert(summary.net === 50000 + 400 - 8035, "net uses full cash expense");

const categories: Category[] = [
  {
    id: "c-shop",
    user_id: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    client_id: "t",
    sync_status: "synced",
    book_id: "b1",
    name: "購物",
    kind: "expense",
    icon: "cart",
    color: "#000",
    sort_order: 0,
  },
];
const breakdown = categoryBreakdown(dayRows, categories, "expense");
const shop = breakdown.find((item) => item.categoryId === "c-shop");
assert(shop?.amount === 6766, `pie shop = 6766, got ${shop?.amount}`);

console.log("reimbursement tests passed");
