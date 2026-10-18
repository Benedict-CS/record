const { Client } = require("pg");
const crypto = require("crypto");

const USER = "4197e225-3723-4082-9b28-0b6e65fcd4c6";
const BOOK = "4e1140bd-1c39-46b0-bfd6-5108b4e9271c"; // 馬來西亞帳本
const CLIENT = "import-myr-holdings-v1";
const START = "2026-09-19";

/** Real MYR assets — totals must be 145217 / est interest 6859.25 */
const ROWS = [
  {
    name: "ASM1",
    kind: "fund",
    institution: "ASNB",
    amount: 24500,
    annual_rate: 5,
    compounding: "simple",
    note: "ASNB unit trust",
    color: "#8e44ad",
    icon: "chart",
    sort_order: 0,
  },
  {
    name: "ASM2",
    kind: "fund",
    institution: "ASNB",
    amount: 19700,
    annual_rate: 5,
    compounding: "simple",
    note: "ASNB unit trust",
    color: "#9b59b6",
    icon: "chart",
    sort_order: 1,
  },
  {
    name: "ASM3",
    kind: "fund",
    institution: "ASNB",
    amount: 90300,
    annual_rate: 4.75,
    compounding: "simple",
    note: "ASNB unit trust",
    color: "#6c3483",
    icon: "chart",
    sort_order: 2,
  },
  {
    name: "Shopee Money+",
    kind: "ewallet",
    institution: "Shopee",
    amount: 10000,
    annual_rate: 3.6,
    compounding: "simple",
    note: "Shopee Money+",
    color: "#e67e22",
    icon: "bag",
    sort_order: 3,
  },
  {
    name: "Maybank Saving",
    kind: "savings",
    institution: "Maybank",
    amount: 14,
    annual_rate: 0,
    compounding: "none",
    note: "活儲",
    color: "#f39c12",
    icon: "building",
    sort_order: 4,
  },
  {
    name: "eGold (TNG)",
    kind: "other",
    institution: "Touch 'n Go",
    amount: 703,
    annual_rate: 0,
    compounding: "none",
    note: "買入成本 RM703；金價不佳，之後可能賣掉",
    color: "#d4ac0d",
    icon: "wallet",
    sort_order: 5,
  },
];

(async () => {
  const total = ROWS.reduce((s, r) => s + r.amount, 0);
  const interest = ROWS.reduce(
    (s, r) => s + (r.amount * r.annual_rate) / 100,
    0,
  );
  console.log("PRECHECK", { n: ROWS.length, total, interest });
  if (total !== 145217) throw new Error(`total ${total} != 145217`);
  if (Math.abs(interest - 6859.25) > 0.01) {
    throw new Error(`interest ${interest} != 6859.25`);
  }

  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  await c.query("begin");

  const stamp = new Date().toISOString();
  const wiped = await c.query(
    `update public.holdings
     set deleted_at = coalesce(deleted_at, $1::timestamptz),
         updated_at = $1::timestamptz,
         client_id = $4
     where user_id = $2 and book_id = $3 and deleted_at is null
     returning id`,
    [stamp, USER, BOOK, CLIENT],
  );
  console.log("WIPED_MYR_HOLDINGS", wiped.rowCount);

  for (const row of ROWS) {
    await c.query(
      `insert into public.holdings (
         id, user_id, book_id, name, kind, institution, amount,
         annual_rate, compounding, start_date, maturity_date, note,
         color, icon, sort_order, updated_at, deleted_at, client_id
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,null,$11,$12,$13,$14,$15,null,$16
       )`,
      [
        crypto.randomUUID(),
        USER,
        BOOK,
        row.name,
        row.kind,
        row.institution,
        row.amount,
        row.annual_rate,
        row.compounding,
        START,
        row.note,
        row.color,
        row.icon,
        row.sort_order,
        stamp,
        CLIENT,
      ],
    );
  }

  const check = await c.query(
    `select
       count(*)::int as n,
       coalesce(sum(amount),0)::float as total,
       coalesce(sum(amount * annual_rate / 100),0)::float as interest
     from public.holdings
     where user_id=$1 and book_id=$2 and deleted_at is null`,
    [USER, BOOK],
  );
  console.log("MYR_AFTER", check.rows[0]);

  await c.query("commit");
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
