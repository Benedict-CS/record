import { isOpenItem, isUnreleasedHold } from "./open-items";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(
  isUnreleasedHold({ type: "hold", hold_status: "held" }),
  "a held row is still open",
);
assert(
  isUnreleasedHold({ type: "hold", hold_status: null }),
  "a hold without a status is still open",
);
assert(
  !isUnreleasedHold({ type: "hold", hold_status: "released" }),
  "a released hold leaves the list",
);
assert(
  !isUnreleasedHold({ type: "expense", hold_status: null }),
  "expenses are not holds",
);

assert(
  isOpenItem({
    type: "expense",
    hold_status: null,
    reimbursable_amount: 400,
    reimbursement_status: "pending",
  }),
  "pending reimbursement stays on the list",
);
assert(
  !isOpenItem({
    type: "expense",
    hold_status: null,
    reimbursable_amount: 400,
    reimbursement_status: "received",
  }),
  "銷帳 removes the reimbursement",
);
assert(
  isOpenItem({
    type: "hold",
    hold_status: "held",
    reimbursable_amount: null,
    reimbursement_status: null,
  }),
  "an unreleased hold stays on the list",
);

console.log("open-items.test.ts ok");
