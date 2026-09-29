import {
  holdingBalanceDeltas,
  nextHoldingBalances,
  nextHoldingSpend,
  storedHoldingSpend,
} from "./holding-spend";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

const stored = storedHoldingSpend({
  type: "expense",
  amount: 120,
  holdingId: "taishin",
  deleted: false,
});
assert(
  stored.holdingId === "taishin" && stored.amount === 120,
  "a saved bank expense still counts as a deduction",
);

const bank = nextHoldingSpend({
  type: "expense",
  amount: 120,
  holdingId: "taishin",
  accountType: "bank",
  deleted: false,
});
assert(bank.holdingId === "taishin" && bank.amount === 120, "bank expense deducts full amount");

const cashAccount = nextHoldingSpend({
  type: "expense",
  amount: 80,
  holdingId: "taishin",
  accountType: "cash",
  deleted: false,
});
assert(
  cashAccount.holdingId === null && cashAccount.amount === 0,
  "cash account does not touch a holding",
);

const credit = nextHoldingSpend({
  type: "expense",
  amount: 80,
  holdingId: "taishin",
  accountType: "credit",
  deleted: false,
});
assert(credit.holdingId === null, "credit does not deduct a bank holding");

const income = nextHoldingSpend({
  type: "income",
  amount: 500,
  holdingId: "taishin",
  accountType: "bank",
  deleted: false,
});
assert(income.holdingId === null && income.amount === 0, "income does not increase a holding");

const treat = nextHoldingSpend({
  type: "expense",
  amount: 0,
  holdingId: "post",
  accountType: "bank",
  deleted: false,
});
assert(treat.holdingId === "post" && treat.amount === 0, "zero expense stays linked without a deduction");

const removed = storedHoldingSpend({
  type: "expense",
  amount: 40,
  holdingId: "taishin",
  deleted: true,
});
assert(removed.amount === 0, "deleted expense no longer deducts");

const createDeltas = holdingBalanceDeltas(
  { holdingId: null, amount: 0 },
  { holdingId: "taishin", amount: 300 },
);
assert(
  createDeltas.length === 1 &&
    createDeltas[0].holdingId === "taishin" &&
    createDeltas[0].deltaCents === -30000,
  "new bank expense deducts 300",
);

const raise = holdingBalanceDeltas(
  { holdingId: "taishin", amount: 100 },
  { holdingId: "taishin", amount: 180 },
);
assert(
  raise.length === 1 && raise[0].deltaCents === -8000,
  "editing the amount only deducts the difference",
);

const lower = holdingBalanceDeltas(
  { holdingId: "taishin", amount: 180 },
  { holdingId: "taishin", amount: 50 },
);
assert(lower.length === 1 && lower[0].deltaCents === 13000, "a smaller amount refunds the difference");

const switched = holdingBalanceDeltas(
  { holdingId: "taishin", amount: 200 },
  { holdingId: "cathay", amount: 200 },
);
const byId = Object.fromEntries(switched.map((row) => [row.holdingId, row.deltaCents]));
assert(byId.taishin === 20000 && byId.cathay === -20000, "changing cards refunds the old bank and deducts the new one");

const toCash = holdingBalanceDeltas(
  { holdingId: "sinopac", amount: 90 },
  { holdingId: null, amount: 0 },
);
assert(
  toCash.length === 1 && toCash[0].holdingId === "sinopac" && toCash[0].deltaCents === 9000,
  "switching to cash refunds the bank holding",
);

const ok = nextHoldingBalances(
  { taishin: 50000 },
  [{ holdingId: "taishin", deltaCents: -12000 }],
);
assert(ok.shortfallId === null && ok.balances.taishin === 38000, "balance falls by the deduction");

const exact = nextHoldingBalances(
  { post: 1000 },
  [{ holdingId: "post", deltaCents: -1000 }],
);
assert(exact.shortfallId === null && exact.balances.post === 0, "spending the full balance is allowed");

const short = nextHoldingBalances(
  { cathay: 500 },
  [{ holdingId: "cathay", deltaCents: -800 }],
);
assert(short.shortfallId === "cathay", "refuses a deduction that would go negative");

const missing = nextHoldingBalances(
  {},
  [{ holdingId: "unknown", deltaCents: -100 }],
);
assert(missing.missingId === "unknown", "missing holding is reported separately");

console.log("holding spend tests ok");
