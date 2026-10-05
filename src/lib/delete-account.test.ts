import { allowedAfterLogin } from "./after-login";
import { formatDeleteAccountError } from "./auth-errors";
import { syncStateId } from "./db/delete-account";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(allowedAfterLogin("/delete-account") === "/delete-account", "delete page can resume");
assert(allowedAfterLogin("/") === "/", "home is not stored as a resume path");
assert(allowedAfterLogin("//evil.example") === "/", "external paths are dropped");
assert(allowedAfterLogin(null) === "/", "missing path goes home");

assert(
  formatDeleteAccountError("Could not find the function public.delete_own_account").includes(
    "016",
  ),
  "a missing rpc points at the migration",
);
assert(
  formatDeleteAccountError("PGRST202").includes("016"),
  "postgrest missing function points at the migration",
);
assert(
  formatDeleteAccountError("not authenticated") === "尚未登入，請先登入再刪除帳號",
  "signed-out calls stay in chinese",
);
assert(
  formatDeleteAccountError("Failed to fetch").includes("網路"),
  "offline does not claim the account is gone",
);
assert(syncStateId("abc") === "user:abc", "sync cursor uses the user prefix");

console.log("delete-account tests ok");
