import {
  calculateMonthlyAllowance,
  resolveEffectiveMonthBudget,
  resolveEffectiveYearBudget,
} from "./budget-calc";
import type { Budget } from "./types";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

function mockBudget(partial: Partial<Budget>): Budget {
  return {
    id: "b-1",
    book_id: "book-1",
    user_id: "u-1",
    year: 2026,
    month: 11,
    category_id: null,
    amount: 1000,
    client_id: "c-1",
    sync_status: "synced",
    updated_at: "2026-11-14T00:00:00.000Z",
    deleted_at: null,
    ...partial,
  };
}

// 1. Month View: explicit monthly budget takes precedence
const explicitMonth = resolveEffectiveMonthBudget({
  categoryId: "cat-dining",
  monthBudgets: [mockBudget({ category_id: "cat-dining", amount: 6000 })],
  yearBudgets: [mockBudget({ category_id: "cat-dining", month: 0, amount: 100000 })],
  currency: "TWD",
});
assert(explicitMonth.amount === 6000, "explicit month budget is used");
assert(explicitMonth.source === "explicit", "source is explicit");
assert(explicitMonth.isFallback === false, "isFallback is false");
assert(explicitMonth.noteText?.includes("72,000"), "annualized note is shown");

// 2. Month View: fallback from annual budget (annual / 12)
const fallbackMonth = resolveEffectiveMonthBudget({
  categoryId: "cat-fun",
  monthBudgets: [], // no month budget set
  yearBudgets: [mockBudget({ category_id: "cat-fun", month: 0, amount: 50000 })],
  currency: "TWD",
});
assert(fallbackMonth.amount === 4167, "50000 / 12 = 4167");
assert(fallbackMonth.source === "derived_from_year", "source is derived_from_year");
assert(fallbackMonth.isFallback === true, "isFallback is true");
assert(fallbackMonth.badgeText === "年折算", "badge text is 年折算");

// 3. Month View: overall budget fallback from category sum
const categorySumMonth = resolveEffectiveMonthBudget({
  categoryId: null,
  monthBudgets: [],
  yearBudgets: [],
  categoryBudgetsSum: 35000,
  currency: "TWD",
});
assert(categorySumMonth.amount === 35000, "category sum is used for overall month");
assert(categorySumMonth.source === "category_sum", "source is category_sum");
assert(categorySumMonth.badgeText === "分類加總", "badge text is 分類加總");

// 4. Year View: explicit annual budget takes precedence
const explicitYear = resolveEffectiveYearBudget({
  categoryId: "cat-fun",
  yearBudgets: [mockBudget({ category_id: "cat-fun", month: 0, amount: 50000 })],
  allMonthBudgets: [mockBudget({ category_id: "cat-fun", month: 11, amount: 10000 })],
  currency: "TWD",
});
assert(explicitYear.amount === 50000, "explicit year budget is used");
assert(explicitYear.source === "explicit", "source is explicit");
assert(explicitYear.isFallback === false, "isFallback is false");

// 5. Year View: fallback from monthly budgets (month * 12)
const fallbackYear = resolveEffectiveYearBudget({
  categoryId: "cat-breakfast",
  yearBudgets: [], // no annual budget
  allMonthBudgets: [mockBudget({ category_id: "cat-breakfast", month: 11, amount: 4500 })],
  currency: "TWD",
});
assert(fallbackYear.amount === 54000, "4500 * 12 = 54000");
assert(fallbackYear.source === "derived_from_month", "source is derived_from_month");
assert(fallbackYear.badgeText === "月推算", "badge text is 月推算");

// 6. Year View: overall budget fallback from category sum
const categorySumYear = resolveEffectiveYearBudget({
  categoryId: null,
  yearBudgets: [],
  allMonthBudgets: [],
  categoryBudgetsSum: 420000,
  currency: "TWD",
});
assert(categorySumYear.amount === 420000, "category sum is used for overall year");
assert(categorySumYear.source === "category_sum", "source is category_sum");
assert(categorySumYear.badgeText === "分類加總", "badge text is 分類加總");

// 7. Monthly allowance calculation for current year
const allowanceCurrent = calculateMonthlyAllowance({
  annualBudgetAmount: 50000,
  spentSoFar: 234,
  year: 2026,
  currentYear: 2026,
  currentMonth: 11,
  currency: "TWD",
});
assert(allowanceCurrent !== null, "allowance is not null");
assert(allowanceCurrent.baseMonthly === 4167, "base monthly is 4167");
assert(allowanceCurrent.remainingMonths === 2, "remaining months is 2 (Nov & Dec)");
assert(allowanceCurrent.remainingBudget === 49766, "remaining budget is 49766");
assert(allowanceCurrent.remainingMonthly === 24883, "remaining monthly is 24883");
assert(allowanceCurrent.text.includes("4,167"), "includes base monthly");
assert(allowanceCurrent.text.includes("24,883"), "includes dynamic remaining monthly");

// 8. Monthly allowance calculation for December
const allowanceDec = calculateMonthlyAllowance({
  annualBudgetAmount: 50000,
  spentSoFar: 30000,
  year: 2026,
  currentYear: 2026,
  currentMonth: 12,
  currency: "TWD",
});
assert(allowanceDec !== null, "dec allowance not null");
assert(allowanceDec.remainingMonths === 1, "remaining months is 1");
assert(allowanceDec.remainingMonthly === 20000, "remaining is 20000");
assert(allowanceDec.text.includes("本月可花 $20,000/月"), "shows 本月可花 for December");

// 9. Monthly allowance calculation when over budget
const allowanceOver = calculateMonthlyAllowance({
  annualBudgetAmount: 50000,
  spentSoFar: 55000,
  year: 2026,
  currentYear: 2026,
  currentMonth: 11,
  currency: "TWD",
});
assert(allowanceOver !== null, "allowance not null");
assert(allowanceOver.remainingMonthly === 0, "remaining is 0 when over");
assert(allowanceOver.text.includes("年度已超支"), "indicates over budget");

// 10. Monthly allowance calculation for past year
const allowancePast = calculateMonthlyAllowance({
  annualBudgetAmount: 60000,
  spentSoFar: 40000,
  year: 2025,
  currentYear: 2026,
  currentMonth: 11,
  currency: "TWD",
});
assert(allowancePast !== null, "past year allowance not null");
assert(allowancePast.baseMonthly === 5000, "base monthly is 5000");
assert(allowancePast.remainingMonths === 0, "remaining months is 0 for past year");

console.log("budget-calc tests passed");
