import {
  accountLabel,
  accountNameError,
  signInAccountError,
  toAuthEmail,
} from "./account-name";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(accountNameError("benedict") === null, "benedict is a valid account");
assert(accountNameError("  Benedict ") === null, "names are trimmed and case-insensitive");
assert(
  accountNameError("ben111611@gmail.com") !== null,
  "signup rejects an email",
);
assert(accountNameError("a") !== null, "one character is too short");
assert(accountNameError("ben edict") !== null, "spaces are rejected");

assert(
  toAuthEmail("Benedict") === "benedict@users.record",
  "username becomes the internal auth email",
);
assert(
  toAuthEmail("ben111611@gmail.com") === "ben111611@gmail.com",
  "an existing email can still be used to sign in",
);

assert(signInAccountError("benedict") === null, "sign in accepts a username");
assert(
  signInAccountError("ben111611@gmail.com") === null,
  "sign in still accepts the old email until it is renamed",
);

assert(
  accountLabel({
    email: "benedict@users.record",
    user_metadata: { username: "benedict" },
  }) === "benedict",
  "the screen shows the account name",
);
assert(
  accountLabel({ email: "ben111611@gmail.com", user_metadata: {} }) ===
    "ben111611@gmail.com",
  "an unmigrated email account still shows that email",
);

console.log("account name tests ok");
