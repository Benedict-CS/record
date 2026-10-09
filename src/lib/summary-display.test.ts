import {
  periodBalance,
  periodSpend,
  reimbursedAmount,
} from "./summary-display";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

// 2026 year card: spend 138952, full expense 140689, holds 22000, income 0.
const year = {
  income: 0,
  expense: 140689,
  held: 22000,
  selfPay: 138952,
};

assert(periodSpend(year) === 138952, "spend is self pay");
assert(periodBalance(year) === -138952, "balance equals income minus spend");
assert(reimbursedAmount(year) === 1737, "reimbursed is the gap between cash expense and spend");

const withIncome = { income: 50000, expense: 8035, selfPay: 7135 };
assert(periodBalance(withIncome) === 50000 - 7135, "income reduces the shown balance");
assert(reimbursedAmount(withIncome) === 900, "received reimbursable is not spend");

console.log("summary display ok");
