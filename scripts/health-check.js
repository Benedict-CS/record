/**
 * Local health check for Record: unit tests + TypeScript.
 * Used by the agent loop; keep fast and deterministic.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const tests = [
  "src/lib/money.test.ts",
  "src/lib/day-order.test.ts",
  "src/lib/category-order.test.ts",
  "src/lib/month-summary.test.ts",
  "src/lib/reimbursement.test.ts",
];

let failed = 0;
for (const file of tests) {
  const r = spawnSync("npx", ["--yes", "tsx", file], {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
  if (r.status !== 0) {
    failed += 1;
    console.error(`FAIL ${file}`);
    if (r.stdout) console.error(r.stdout);
    if (r.stderr) console.error(r.stderr);
  } else {
    console.log(`OK ${file}`);
  }
}

const tsc = spawnSync("npx", ["tsc", "--noEmit"], {
  cwd: root,
  encoding: "utf8",
  shell: true,
});
if (tsc.status !== 0) {
  failed += 1;
  console.error("FAIL tsc");
  if (tsc.stdout) console.error(tsc.stdout);
  if (tsc.stderr) console.error(tsc.stderr);
} else {
  console.log("OK tsc");
}

if (failed > 0) {
  console.error(`HEALTH_FAIL count=${failed}`);
  process.exit(1);
}
console.log("HEALTH_OK");
process.exit(0);
