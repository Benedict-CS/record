import { applyKey, evaluateExpression, toAmountValue } from "./calculator";
import {
  accruedInterest,
  monthlyInterest,
  monthlyProjection,
  yearlyInterest,
} from "./interest";
import type { Holding } from "./types";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

function closeTo(actual: number, expected: number, label: string, eps = 1e-6) {
  assert(
    Math.abs(actual - expected) <= eps,
    `${label}: expected ${expected}, got ${actual}`,
  );
}

function sampleHolding(patch: Partial<Holding> = {}): Holding {
  return {
    id: "h1",
    user_id: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    client_id: "test",
    sync_status: "pending",
    book_id: "b1",
    name: "定存",
    kind: "deposit",
    institution: "郵局",
    amount: 100_000,
    annual_rate: 1.2,
    compounding: "simple",
    start_date: "2026-01-01",
    maturity_date: null,
    note: "",
    color: "#0f7a5f",
    icon: "building",
    sort_order: 0,
    ...patch,
  };
}

closeTo(monthlyInterest(120_000, 1.2), 120, "monthly coupon");
closeTo(monthlyInterest(100, 0), 0, "zero rate");
closeTo(monthlyInterest(0, 5), 0, "zero principal");
closeTo(yearlyInterest(1_000, 12, "simple"), 120, "yearly simple");
closeTo(yearlyInterest(1_000, 12, "yearly"), 120, "yearly compounding coupon");
closeTo(yearlyInterest(1_000, 12, "none"), 0, "no interest");
assert(
  yearlyInterest(1_000, 12, "monthly") > 120,
  "monthly compounding exceeds simple",
);

const asOf = new Date(2026, 6, 1); // 1 Jul 2026, ~181 days from 1 Jan
const accrued = accruedInterest(sampleHolding(), asOf);
assert(accrued > 500 && accrued < 700, `accrued in range, got ${accrued}`);
closeTo(accruedInterest(sampleHolding({ compounding: "none" }), asOf), 0, "none");

const rows = monthlyProjection(sampleHolding({ annual_rate: 12, amount: 10_000 }), 12);
assert(rows.length === 12, "12 projection rows");
closeTo(rows[0].interest, 100, "first month simple coupon");
closeTo(rows[11].balance, 11_200, "year-end simple balance");

const compounded = monthlyProjection(
  sampleHolding({
    amount: 10_000,
    annual_rate: 12,
    compounding: "monthly",
  }),
  12,
);
assert(
  compounded[11].balance > rows[11].balance,
  "monthly compound grows faster",
);

assert(evaluateExpression("10+2*3") === 16, "operator precedence");
assert(evaluateExpression("100+") === 100, "trailing operator preview");
assert(applyKey("", "1") === "1", "first digit");
assert(applyKey("0", "5") === "5", "replace leading zero");
assert(toAmountValue("12.5") === 12.5, "amount parse");
assert(toAmountValue("0") === null, "zero is not a ledger amount");
assert(toAmountValue("10+") === null, "incomplete expression");

console.log("money tests passed");
