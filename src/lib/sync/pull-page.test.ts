import {
  FULL_PULL_VERSION,
  PULL_PAGE_SIZE,
  needsFullCloudPull,
  takePullPage,
} from "./pull-page";

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

const caughtUp = {
  since: "2026-10-08T06:00:00.000Z",
  localCount: 800,
  pullVersion: FULL_PULL_VERSION,
};
assert(!needsFullCloudPull(caughtUp), "a current cursor stays incremental");
assert(
  needsFullCloudPull({ ...caughtUp, pullVersion: 1 }),
  "an older pull version downloads everything",
);
assert(
  needsFullCloudPull({ ...caughtUp, pullVersion: undefined }),
  "a cursor from before paged pulls downloads everything",
);

console.log("pull-page tests ok");
