import { missingColumnName, withoutColumn } from "./schema-compat";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

const column = missingColumnName({
  code: "PGRST204",
  message:
    "Could not find the 'holding_id' column of 'transactions' in the schema cache",
});
assert(column === "holding_id", "reads the missing column from PGRST204");
assert(
  missingColumnName({ code: "42501", message: "permission denied" }) === null,
  "other errors are not treated as a missing column",
);

const stripped = withoutColumn(
  [{ id: "t1", amount: 120, holding_id: "bank-1" }],
  "holding_id",
);
assert(!("holding_id" in stripped[0]), "drops holding_id so the upload can proceed");
assert(stripped[0].id === "t1" && stripped[0].amount === 120, "keeps the rest of the row");

console.log("schema compat tests ok");
