import { isLocalReceiptPath, localReceiptPath, receiptTransactionId } from "./receipt";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(localReceiptPath("abc") === "local:abc", "local prefix");
assert(isLocalReceiptPath("local:abc") === true, "detects local");
assert(isLocalReceiptPath("user/abc.jpg") === false, "cloud path is not local");
assert(receiptTransactionId("local:abc") === "abc", "id from local path");
assert(receiptTransactionId("uid/abc.jpg") === "abc", "id from storage path");
assert(receiptTransactionId(null) === null, "empty path");

console.log("receipt.test.ts ok");
