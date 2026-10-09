import {
  holdingBalanceDeltas,
  holdingLinkNeedsLiveTarget,
  nextHoldingBalances,
  nextHoldingSpend,
  storedHoldingSpend,
  type HoldingSpendLink,
} from "./holding-spend";

function deduct(holdingId: string | null, amount: number): HoldingSpendLink {
  return { holdingId, amount, sign: -1 };
}

function creditLink(holdingId: string | null, amount: number): HoldingSpendLink {
  return { holdingId, amount, sign: 1 };
}

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
  stored.holdingId === "taishin" && stored.amount === 120 && stored.sign === -1,
  "a saved bank expense still counts as a deduction",
);

const bank = nextHoldingSpend({
  type: "expense",
  amount: 120,
  holdingId: "taishin",
  accountType: "bank",
  deleted: false,
});
assert(
  bank.holdingId === "taishin" && bank.amount === 120 && bank.sign === -1,
  "bank expense deducts full amount",
);

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
assert(
  income.holdingId === "taishin" && income.amount === 500 && income.sign === 1,
  "bank income credits the full amount",
);

const cashIncome = nextHoldingSpend({
  type: "income",
  amount: 500,
  holdingId: "taishin",
  accountType: "cash",
  deleted: false,
});
assert(cashIncome.holdingId === null, "cash income does not touch a holding");

const deletedIncome = storedHoldingSpend({
  type: "income",
  amount: 500,
  holdingId: "taishin",
  deleted: true,
});
assert(deletedIncome.amount === 0, "deleted income no longer credits");

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
  deduct(null, 0),
  deduct("taishin", 300),
);
assert(
  createDeltas.length === 1 &&
    createDeltas[0].holdingId === "taishin" &&
    createDeltas[0].deltaCents === -30000,
  "new bank expense deducts 300",
);

const raise = holdingBalanceDeltas(
  deduct("taishin", 100),
  deduct("taishin", 180),
);
assert(
  raise.length === 1 && raise[0].deltaCents === -8000,
  "editing the amount only deducts the difference",
);

const lower = holdingBalanceDeltas(
  deduct("taishin", 180),
  deduct("taishin", 50),
);
assert(lower.length === 1 && lower[0].deltaCents === 13000, "a smaller amount refunds the difference");

const switched = holdingBalanceDeltas(
  deduct("taishin", 200),
  deduct("cathay", 200),
);
const byId = Object.fromEntries(switched.map((row) => [row.holdingId, row.deltaCents]));
assert(byId.taishin === 20000 && byId.cathay === -20000, "changing cards refunds the old bank and deducts the new one");

const toCash = holdingBalanceDeltas(
  deduct("sinopac", 90),
  deduct(null, 0),
);

const incomeIn = holdingBalanceDeltas(creditLink(null, 0), creditLink("post", 500));
assert(
  incomeIn.length === 1 && incomeIn[0].deltaCents === 50000,
  "new bank income credits 500",
);

const incomeRaise = holdingBalanceDeltas(creditLink("post", 500), creditLink("post", 800));
assert(
  incomeRaise.length === 1 && incomeRaise[0].deltaCents === 30000,
  "raising income only credits the difference",
);

const incomeSwitch = holdingBalanceDeltas(creditLink("post", 200), creditLink("taishin", 200));
const incomeById = Object.fromEntries(
  incomeSwitch.map((row) => [row.holdingId, row.deltaCents]),
);
assert(
  incomeById.post === -20000 && incomeById.taishin === 20000,
  "changing the income card moves the credit",
);

const undoIncome = holdingBalanceDeltas(creditLink("post", 200), creditLink(null, 0));
assert(
  undoIncome.length === 1 && undoIncome[0].deltaCents === -20000,
  "clearing a bank income takes the credit back",
);

assert(
  holdingLinkNeedsLiveTarget(creditLink(null, 0), creditLink("post", 100)),
  "a new credit needs a live holding",
);
assert(
  !holdingLinkNeedsLiveTarget(creditLink("post", 180), creditLink("post", 50)),
  "a smaller credit on the same card does not require a new target",
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
