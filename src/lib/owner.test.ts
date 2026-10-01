import assert from "node:assert/strict";
import { sameOwner } from "./db/owner";

assert.equal(sameOwner(null, null), true);
assert.equal(sameOwner(undefined, null), true);
assert.equal(sameOwner("account-a", "account-a"), true);
assert.equal(sameOwner(null, "account-b"), false);
assert.equal(sameOwner("account-a", "account-b"), false);
assert.equal(sameOwner("account-a", null), false);

console.log("owner tests ok");
