const { Client } = require("pg");
const crypto = require("crypto");

const USER = "4197e225-3723-4082-9b28-0b6e65fcd4c6";
const BOOK = "8765897c-1a8c-41ca-82bc-aee87630468e"; // 台灣帳本
const CLIENT = "import-twd-holdings-v1";
const START = "2026-09-19";

/** Current TWD cash/bank positions. Total must be 72173. */
const ROWS = [
  {
    name: "永豐",
    kind: "savings",
    institution: "永豐銀行",
    amount: 1010,
    annual_rate: 0,
    compounding: "none",
    note: "主帳戶",
    color: "#27ae60",
    icon: "building",
    sort_order: 0,
  },
  {
    name: "郵局",
    kind: "savings",
    institution: "中華郵政",
    amount: 916,
    annual_rate: 0,
    compounding: "none",
    note: "主帳戶",
    color: "#1abc9c",
    icon: "building",
    sort_order: 1,
  },
  {
    name: "台新",
    kind: "savings",
    institution: "台新銀行",
    amount: 5544,
    annual_rate: 0,
    compounding: "none",
    note: "主帳戶",
    color: "#e74c3c",
    icon: "building",
    sort_order: 2,
  },
  {
    name: "台新定存",
    kind: "deposit",
    institution: "台新銀行",
    amount: 59000,
    annual_rate: 0,
    compounding: "none",
    note: "定存",
    color: "#c0392b",
    icon: "building",
    sort_order: 3,
  },
  {
    name: "國泰",
    kind: "savings",
    institution: "國泰世華",
    amount: 3703,
    annual_rate: 0,
    compounding: "none",
    note: "主帳戶",
    color: "#2980b9",
    icon: "building",
    sort_order: 4,
  },
  {
    name: "現金",
    kind: "cash",
    institution: "",
    amount: 2000,
    annual_rate: 0,
    compounding: "none",
    note: "手上現金",
    color: "#27ae60",
    icon: "wallet",
    sort_order: 5,
  },
];

(async () => {
  const total = ROWS.reduce((s, r) => s + r.amount, 0);
  console.log("PRECHECK", { n: ROWS.length, total });
  if (total !== 72173) throw new Error(`total ${total} != 72173`);

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
  console.log("WIPED_TWD_HOLDINGS", wiped.rowCount);

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
    `select count(*)::int as n, coalesce(sum(amount),0)::float as total
     from public.holdings
     where user_id=$1 and book_id=$2 and deleted_at is null`,
    [USER, BOOK],
  );
  console.log("TWD_AFTER", check.rows[0]);

  await c.query("commit");
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
