import { PULL_PAGE_SIZE, takePullPage } from "./pull-page";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

const seen = new Set<string>();
const full = Array.from({ length: PULL_PAGE_SIZE }, (_, index) => ({
  id: `row-${index}`,
}));
const first = takePullPage(full, seen);
assert(first.rows.length === PULL_PAGE_SIZE && !first.done, "a full page continues");

const repeated = takePullPage(full, seen);
assert(repeated.rows.length === 0 && repeated.done, "a repeated page is dropped");

const seenAgain = new Set<string>();
const tail = [{ id: "last" }];
const last = takePullPage(tail, seenAgain);
assert(last.rows.length === 1 && last.done, "a short page ends the pull");

const empty = takePullPage([], new Set<string>());
assert(empty.rows.length === 0 && empty.done, "an empty page ends the pull");

console.log("pull-page tests ok");
