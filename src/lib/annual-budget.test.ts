import type { Budget } from "./types";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

// Ensure Budget interface allows month = 0 for annual budget
const annualBudget: Budget = {
  id: "test-budget-1",
  book_id: "book-1",
  user_id: "user-1",
  year: 2026,
  month: 0,
  category_id: null,
  amount: 600000,
  client_id: "client-1",
  sync_status: "pending",
  updated_at: "2026-11-13T00:00:00.000Z",
  deleted_at: null,
};

assert(annualBudget.month === 0, "annual budget has month 0");
assert(annualBudget.amount === 600000, "annual budget amount matches");
assert(annualBudget.category_id === null, "overall annual budget has null category_id");

const categoryAnnualBudget: Budget = {
  ...annualBudget,
  id: "test-budget-2",
  category_id: "cat-dining",
  amount: 120000,
};

assert(categoryAnnualBudget.month === 0, "category annual budget has month 0");
assert(categoryAnnualBudget.category_id === "cat-dining", "category annual budget has category_id");

console.log("annual budget tests ok");
