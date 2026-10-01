import { categoryBreakdown, monthSummary } from "./db/crud";
import {
  normalizeTransactionTag,
  tagSearchText,
  TREAT_TAG,
} from "./transaction-tag";
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
    category_id: "dinner",
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

assert(normalizeTransactionTag("expense", TREAT_TAG) === TREAT_TAG, "expense can be tagged 請客");
assert(normalizeTransactionTag("expense", "dinner") === null, "unknown tags are dropped");
assert(normalizeTransactionTag("income", TREAT_TAG) === null, "income cannot carry the tag");
assert(normalizeTransactionTag("hold", TREAT_TAG) === null, "a hold cannot carry the tag");
assert(tagSearchText(TREAT_TAG) === "請客", "search text is the label");
assert(tagSearchText(null) === "", "untagged rows add no search text");

const dinner: Category = {
  id: "dinner",
  user_id: null,
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  client_id: "test",
  sync_status: "synced",
  book_id: "b1",
  name: "晚餐",
  kind: "expense",
  icon: "moon",
  color: "#d35400",
  sort_order: 2,
};

const tagged = tx({
  type: "expense",
  amount: 500,
  date: "2026-09-30",
  category_id: "dinner",
  tag: TREAT_TAG,
});
const plain = tx({
  type: "expense",
  amount: 80,
  date: "2026-09-30",
  category_id: "dinner",
  tag: null,
});

const summary = monthSummary([tagged, plain]);
assert(summary.expense === 580, "a tag does not add the amount a second time");
assert(summary.selfPay === 580, "spend still counts the tagged row once");

const breakdown = categoryBreakdown([tagged, plain], [dinner]);
assert(breakdown.length === 1, "tagged dinner stays in one category");
assert(breakdown[0].name === "晚餐", "the category is still 晚餐");
assert(breakdown[0].amount === 580, "category total is not doubled");
assert(breakdown[0].percent === 100, "the pie stays at 100 percent");

console.log("transaction tag ok");
