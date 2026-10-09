import {
  missingColumnName,
  plainSyncFailure,
  preserveUnsyncedField,
  remoteWins,
  withoutColumn,
} from "./schema-compat";

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

const stamp = "2026-09-30T08:00:00.000Z";
const kept = preserveUnsyncedField({
  remoteHasKey: true,
  remoteValue: null,
  localValue: "treat",
  remoteUpdatedAt: stamp,
  localUpdatedAt: stamp,
});
assert(kept.value === "treat" && kept.needsUpload, "a blank cloud tag is uploaded from this device");

const cleared = preserveUnsyncedField({
  remoteHasKey: true,
  remoteValue: null,
  localValue: "treat",
  remoteUpdatedAt: "2026-10-01T08:00:00.000Z",
  localUpdatedAt: stamp,
});
assert(cleared.value === null && !cleared.needsUpload, "a newer cloud row can clear the tag");

const missing = preserveUnsyncedField({
  remoteHasKey: false,
  remoteValue: null,
  localValue: "treat",
  remoteUpdatedAt: stamp,
  localUpdatedAt: stamp,
});
assert(missing.value === "treat" && !missing.needsUpload, "a missing column keeps the local tag");

assert(
  plainSyncFailure({
    code: "PGRST204",
    message: "Could not find the 'holding_id' column of 'transactions' in the schema cache",
  }) === "這台已存好，雲端還沒這欄，所以上不去。",
  "a missing column is explained in plain language",
);
assert(
  plainSyncFailure({ code: "PGRST205", message: "Could not find the table public.recurring_rules" }) ===
    "這台已存好，雲端還沒這張表，所以上不去。",
  "a missing table is explained in plain language",
);
assert(
  plainSyncFailure({ code: "23514", message: "new row violates check constraint" }) ===
    "這台已存好，雲端還不接受這筆資料，所以上不去。",
  "a check constraint is explained in plain language",
);
assert(
  plainSyncFailure({ code: "42501", message: "permission denied" }) === null,
  "other failures keep the detailed formatter",
);

// PostgREST trims trailing zeros and uses +00:00; the device writes …Z.
assert(
  remoteWins("2026-10-09T15:22:43.5+00:00", "2026-10-09T15:22:43.499Z"),
  "a later cloud instant wins even when the string sorts lower",
);
assert(
  !remoteWins("2026-10-09T15:22:43+00:00", "2026-10-09T15:22:43.001Z"),
  "a 1ms newer local row is kept",
);
assert(
  remoteWins("2026-10-09T15:22:43.030+00:00", "2026-10-09T15:22:43.030Z"),
  "the same instant lets the cloud row through",
);
assert(remoteWins("2026-10-09T15:22:43.030Z", undefined), "no local row means the cloud row is taken");
assert(!remoteWins(null, "2026-10-09T15:22:43.030Z"), "a cloud row without a stamp never overwrites");

console.log("schema compat tests ok");
