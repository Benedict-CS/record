import { diffDays, getMaturingHoldings, getMaturityBadge } from "./holding-maturity";
import type { Holding } from "./types";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(diffDays("2026-11-14", "2026-11-20") === 6, "diff is 6 days");
assert(diffDays("2026-11-14", "2026-11-14") === 0, "diff is 0 days for today");
assert(diffDays("2026-11-14", "2026-11-10") === -4, "diff is -4 for past date");

const baseHolding: Holding = {
  id: "h1",
  book_id: "b1",
  user_id: "u1",
  name: "台北富邦 1 年期定存",
  kind: "deposit",
  institution: "台北富邦",
  amount: 200000,
  annual_rate: 1.7,
  compounding: "monthly",
  start_date: "2025-11-20",
  maturity_date: "2026-11-20",
  note: "",
  color: "#0f7a5f",
  icon: "dots",
  sort_order: 0,
  client_id: "c1",
  sync_status: "synced",
  updated_at: "2026-11-14T00:00:00Z",
  deleted_at: null,
};

// Maturing in 6 days
const holdings = [
  baseHolding,
  {
    ...baseHolding,
    id: "h2",
    name: "台新活存",
    maturity_date: null,
  },
  {
    ...baseHolding,
    id: "h3",
    name: "已到期定存",
    maturity_date: "2026-11-10",
  },
  {
    ...baseHolding,
    id: "h4",
    name: "很久以後才到期",
    maturity_date: "2027-05-01",
  },
];

const results = getMaturingHoldings(holdings, "2026-11-14", 14);
assert(results.length === 2, `should find 2 maturing holdings, found ${results.length}`);
assert(results[0].holding.id === "h3", "overdue should come first");
assert(results[0].status === "overdue", "status is overdue");
assert(results[1].holding.id === "h1", "h1 is soon");
assert(results[1].status === "soon", "status is soon");
assert(results[1].daysUntil === 6, "daysUntil is 6");

const badgeSoon = getMaturityBadge("2026-11-20", "2026-11-14");
assert(badgeSoon?.isUrgent === true && badgeSoon.label === "剩 6 天到期", "badge format for soon");

const badgeFuture = getMaturityBadge("2027-05-01", "2026-11-14");
assert(badgeFuture?.isUrgent === false, "far future is not urgent");

console.log("holding-maturity tests passed");
