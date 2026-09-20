import {
  compareSameDayTransactions,
  mealRank,
} from "./day-order";
import type { Transaction } from "./types";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

function tx(
  id: string,
  category_id: string | null,
  updated_at: string,
): Transaction {
  return {
    id,
    user_id: null,
    updated_at,
    deleted_at: null,
    client_id: "t",
    sync_status: "pending",
    book_id: "b",
    type: "expense",
    amount: 100,
    date: "2026-09-19",
    note: "",
    account_id: "a",
    category_id,
    transfer_account_id: null,
    hold_status: null,
    release_transaction_id: null,
    reimbursable_amount: null,
    reimbursement_status: null,
  };
}

assert(mealRank("早餐") === 0, "breakfast rank");
assert(mealRank("午餐") === 1, "lunch rank");
assert(mealRank("晚餐") === 2, "dinner rank");
assert(mealRank("交通") === 100, "other rank");

const names: Record<string, string> = {
  c1: "交通",
  c2: "晚餐",
  c3: "早餐",
  c4: "午餐",
};
const nameOf = (id: string | null) => (id ? names[id] : null);

const rows = [
  tx("late-edit", "c1", "2026-09-19T23:00:00.000Z"),
  tx("dinner", "c2", "2026-09-19T22:00:00.000Z"),
  tx("breakfast", "c3", "2026-09-19T01:00:00.000Z"),
  tx("lunch", "c4", "2026-09-19T20:00:00.000Z"),
].sort((a, b) => compareSameDayTransactions(a, b, nameOf));

assert(
  rows.map((row) => row.id).join(",") === "breakfast,lunch,dinner,late-edit",
  `meal order got ${rows.map((row) => row.id).join(",")}`,
);

// No breakfast → lunch then dinner still lead.
const noBreakfast = [
  tx("gas", "c1", "2026-09-19T23:59:00.000Z"),
  tx("dinner2", "c2", "2026-09-19T10:00:00.000Z"),
  tx("lunch2", "c4", "2026-09-19T09:00:00.000Z"),
].sort((a, b) => compareSameDayTransactions(a, b, nameOf));

assert(
  noBreakfast.map((row) => row.id).join(",") === "lunch2,dinner2,gas",
  `no-breakfast order got ${noBreakfast.map((row) => row.id).join(",")}`,
);

function holdTx(id: string, note: string): Transaction {
  return {
    ...tx(id, null, "2026-09-19T12:00:00.000Z"),
    type: "hold",
    note,
    hold_status: "held",
  };
}

const withHolds = [
  holdTx("hold-rent", "房租押金"),
  tx("other", "c1", "2026-09-19T11:00:00.000Z"),
  holdTx("hold-power", "電費預繳"),
  tx("lunch3", "c4", "2026-09-19T10:00:00.000Z"),
  tx("dinner3", "c2", "2026-09-19T09:00:00.000Z"),
].sort((a, b) => compareSameDayTransactions(a, b, nameOf));

assert(
  withHolds.map((row) => row.id).join(",") ===
    "lunch3,dinner3,other,hold-power,hold-rent",
  `hold-last order got ${withHolds.map((row) => row.id).join(",")}`,
);

console.log("day-order tests passed");
