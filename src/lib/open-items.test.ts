import { groupOpenItems, isOpenItem, isUnreleasedHold } from "./open-items";

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

const grouped = groupOpenItems([
  {
    id: "h1",
    type: "hold",
    date: "2026-10-15",
    note: "電費預繳",
    amount: 1000,
    category_id: null,
    hold_status: "held",
    reimbursable_amount: null,
    reimbursement_status: null,
  },
  {
    id: "h2",
    type: "hold",
    date: "2026-11-15",
    note: "電費預繳",
    amount: 1000,
    category_id: null,
    hold_status: "held",
    reimbursable_amount: null,
    reimbursement_status: null,
  },
  {
    id: "g1",
    type: "expense",
    date: "2026-10-01",
    note: "健身房",
    amount: 1088,
    category_id: null,
    hold_status: null,
    reimbursable_amount: 400,
    reimbursement_status: "pending",
  },
  {
    id: "done",
    type: "hold",
    date: "2026-09-15",
    note: "電費預繳",
    amount: 1000,
    category_id: null,
    hold_status: "released",
    reimbursable_amount: null,
    reimbursement_status: null,
  },
]);
assert(grouped.length === 2, "same hold name across months is one group, plus the gym");
assert(grouped[0].title === "健身房" && grouped[0].amount === 400, "gym stays its own reimbursement");
assert(
  grouped[1].title === "扣住：電費預繳" &&
    grouped[1].items.length === 2 &&
    grouped[1].amount === 2000,
  "utility holds add up and a released row stays out",
);

console.log("open-items.test.ts ok");
