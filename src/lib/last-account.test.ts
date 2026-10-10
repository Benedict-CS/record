import {
  isFormTxType,
  lastAccountStorageKey,
  lastHoldingStorageKey,
  lastTxTypeStorageKey,
  preferredStoredId,
} from "./last-account";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(
  preferredStoredId("cash", "card", ["card", "cash"]) === "cash",
  "an explicit account wins",
);
assert(
  preferredStoredId("gone", "card", ["card", "cash"]) === "card",
  "a missing explicit id falls through to the remembered one",
);
assert(
  preferredStoredId("", "card", ["card", "cash"]) === "card",
  "an empty choice uses the remembered account",
);
assert(
  preferredStoredId("", "gone", ["cash"]) === "cash",
  "a missing memory uses the first account",
);
assert(
  lastAccountStorageKey("book-1") === "ledger_last_account_book-1",
  "account key keeps the ledger_ prefix",
);
assert(
  lastHoldingStorageKey("book-1") === "ledger_last_holding_book-1",
  "holding key keeps the ledger_ prefix",
);
assert(lastTxTypeStorageKey() === "ledger_last_tx_type", "type key keeps the ledger_ prefix");
assert(isFormTxType("income"), "income is a form type");
assert(!isFormTxType("invest"), "invest is not a form type");

console.log("last-account tests ok");
