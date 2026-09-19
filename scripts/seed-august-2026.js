/**
 * One-off: seed demo transactions for August 2026 into the TWD book.
 * Run: node scripts/seed-august-2026.js
 * Requires env DB = postgres connection string (service / direct).
 */
const { Client } = require("pg");
const crypto = require("crypto");

const USER_ID = "4197e225-3723-4082-9b28-0b6e65fcd4c6";
const BOOK_ID = "8765897c-1a8c-41ca-82bc-aee87630468e"; // 台灣帳本
const CLIENT_ID = "seed-august-2026";

const ACC = {
  cash: "59815047-a661-419a-aa4e-80325a280bd3",
  bank: "01f32db5-7e6b-4f9a-a215-ebfb86ad069d",
  credit: "58801b05-8b99-4dfa-a9fb-1287b84d25eb",
};

const CAT = {
  breakfast: "08ebeef5-0616-4ac6-bf53-293eaaa18081",
  lunch: "ccf6a0be-955e-43d1-84a5-d9242a6b6128",
  dinner: "68df0259-0129-4d98-b689-cb833edca7c1",
  snack: "1b5f709e-2ae7-408e-be34-1fe34cd027c6",
  transport: "0e1c421d-cfa4-4549-b9b9-89356891edee",
  phone: "7e4f26c0-44bf-422e-93bd-b68e6ada1ea7",
  rent: "041690cc-e595-4c1e-b405-1cbd2b384f6d",
  shopping: "4bdf1701-414e-48e0-bb7c-07e242fb1f10",
  fun: "73611d81-2063-4338-9fbf-5abc4e7d7601",
  medical: "439e612f-20d9-4a23-88a7-02f5bdcb81ad",
  learn: "c5c8ff3f-98e1-48e5-a2f5-398c33b2c363",
  otherExp: "19d24cfd-59dc-4d3e-b660-705117f38e26",
  salary: "ce18c4ff-82f8-4039-ba6c-ce4d2dc093b4",
  bonus: "8c15fd7f-9f96-4ea0-819c-976b65595164",
};

function uuid() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

/** @type {Array<{type:string,amount:number,date:string,note:string,account:string,category:string|null,transfer?:string|null}>} */
const ROWS = [
  // Income
  { type: "income", amount: 52000, date: "2026-08-05", note: "八月薪水（示範）", account: ACC.bank, category: CAT.salary },
  { type: "income", amount: 3000, date: "2026-08-28", note: "專案獎金（示範）", account: ACC.bank, category: CAT.bonus },

  // Fixed
  { type: "expense", amount: 18000, date: "2026-08-01", note: "房租（示範）", account: ACC.bank, category: CAT.rent },
  { type: "expense", amount: 699, date: "2026-08-08", note: "手機月租（示範）", account: ACC.bank, category: CAT.phone },
  { type: "expense", amount: 1200, date: "2026-08-12", note: "水電費（示範）", account: ACC.bank, category: CAT.rent },

  // Transfers
  { type: "transfer", amount: 5000, date: "2026-08-06", note: "提領現金（示範）", account: ACC.bank, category: null, transfer: ACC.cash },
  { type: "transfer", amount: 8000, date: "2026-08-25", note: "還信用卡（示範）", account: ACC.bank, category: null, transfer: ACC.credit },

  // Daily-ish meals / transport (sample days)
  { type: "expense", amount: 65, date: "2026-08-03", note: "美而美早餐", account: ACC.cash, category: CAT.breakfast },
  { type: "expense", amount: 120, date: "2026-08-03", note: "便當", account: ACC.cash, category: CAT.lunch },
  { type: "expense", amount: 45, date: "2026-08-03", note: "捷運", account: ACC.cash, category: CAT.transport },
  { type: "expense", amount: 220, date: "2026-08-03", note: "晚餐火鍋分攤", account: ACC.credit, category: CAT.dinner },

  { type: "expense", amount: 55, date: "2026-08-04", note: "早餐店", account: ACC.cash, category: CAT.breakfast },
  { type: "expense", amount: 135, date: "2026-08-04", note: "公司附近午餐", account: ACC.cash, category: CAT.lunch },
  { type: "expense", amount: 50, date: "2026-08-04", note: "飲料", account: ACC.cash, category: CAT.snack },
  { type: "expense", amount: 180, date: "2026-08-04", note: "晚餐", account: ACC.cash, category: CAT.dinner },

  { type: "expense", amount: 70, date: "2026-08-07", note: "早餐", account: ACC.cash, category: CAT.breakfast },
  { type: "expense", amount: 150, date: "2026-08-07", note: "午餐", account: ACC.cash, category: CAT.lunch },
  { type: "expense", amount: 90, date: "2026-08-07", note: "Uber", account: ACC.credit, category: CAT.transport },
  { type: "expense", amount: 260, date: "2026-08-07", note: "晚餐聚餐", account: ACC.credit, category: CAT.dinner },

  { type: "expense", amount: 60, date: "2026-08-11", note: "早餐", account: ACC.cash, category: CAT.breakfast },
  { type: "expense", amount: 110, date: "2026-08-11", note: "午餐", account: ACC.cash, category: CAT.lunch },
  { type: "expense", amount: 45, date: "2026-08-11", note: "捷運加悠遊卡", account: ACC.cash, category: CAT.transport },
  { type: "expense", amount: 199, date: "2026-08-11", note: "晚餐", account: ACC.cash, category: CAT.dinner },

  { type: "expense", amount: 1280, date: "2026-08-09", note: "UNIQLO（示範）", account: ACC.credit, category: CAT.shopping },
  { type: "expense", amount: 450, date: "2026-08-15", note: "電影＋爆米花", account: ACC.credit, category: CAT.fun },
  { type: "expense", amount: 890, date: "2026-08-16", note: "全聯採買", account: ACC.cash, category: CAT.shopping },
  { type: "expense", amount: 350, date: "2026-08-18", note: "診所掛號＋藥", account: ACC.cash, category: CAT.medical },
  { type: "expense", amount: 599, date: "2026-08-20", note: "線上課程（示範）", account: ACC.credit, category: CAT.learn },
  { type: "expense", amount: 320, date: "2026-08-22", note: "咖啡廳工作", account: ACC.credit, category: CAT.snack },
  { type: "expense", amount: 75, date: "2026-08-24", note: "早餐", account: ACC.cash, category: CAT.breakfast },
  { type: "expense", amount: 140, date: "2026-08-24", note: "午餐", account: ACC.cash, category: CAT.lunch },
  { type: "expense", amount: 210, date: "2026-08-24", note: "晚餐", account: ACC.cash, category: CAT.dinner },
  { type: "expense", amount: 80, date: "2026-08-26", note: "飲料零食", account: ACC.cash, category: CAT.snack },
  { type: "expense", amount: 1600, date: "2026-08-29", note: "朋友生日禮（示範）", account: ACC.credit, category: CAT.otherExp },
  { type: "expense", amount: 680, date: "2026-08-30", note: "週末晚餐", account: ACC.credit, category: CAT.dinner },
];

async function main() {
  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  // Avoid duplicating if re-run: delete previous demo rows for Aug 2026 with this client_id
  await c.query(
    `delete from public.transactions
     where user_id = $1 and book_id = $2 and client_id = $3
       and date >= '2026-08-01' and date < '2026-09-01'`,
    [USER_ID, BOOK_ID, CLIENT_ID],
  );

  await c.query(
    `delete from public.budgets
     where user_id = $1 and book_id = $2 and client_id = $3
       and year = 2026 and month = 8`,
    [USER_ID, BOOK_ID, CLIENT_ID],
  );

  const stamp = nowIso();
  let inserted = 0;

  for (const row of ROWS) {
    await c.query(
      `insert into public.transactions (
        id, user_id, book_id, type, amount, date, note,
        account_id, category_id, transfer_account_id,
        updated_at, deleted_at, client_id
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,null,$12
      )`,
      [
        uuid(),
        USER_ID,
        BOOK_ID,
        row.type,
        row.amount,
        row.date,
        row.note,
        row.account,
        row.category,
        row.transfer ?? null,
        stamp,
        CLIENT_ID,
      ],
    );
    inserted += 1;
  }

  // Overall monthly budget + a couple category budgets (demo)
  const budgets = [
    { category_id: null, amount: 45000 },
    { category_id: CAT.lunch, amount: 8000 },
    { category_id: CAT.transport, amount: 3000 },
    { category_id: CAT.shopping, amount: 5000 },
  ];

  for (const b of budgets) {
    await c.query(
      `insert into public.budgets (
        id, user_id, book_id, year, month, category_id, amount,
        updated_at, deleted_at, client_id
      ) values ($1,$2,$3,2026,8,$4,$5,$6,null,$7)`,
      [uuid(), USER_ID, BOOK_ID, b.category_id, b.amount, stamp, CLIENT_ID],
    );
  }

  const check = await c.query(
    `select count(*)::int as n, coalesce(sum(amount),0)::float as sum_amount
     from public.transactions
     where user_id = $1 and book_id = $2 and client_id = $3
       and date >= '2026-08-01' and date < '2026-09-01'
       and deleted_at is null`,
    [USER_ID, BOOK_ID, CLIENT_ID],
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        inserted,
        budgets: budgets.length,
        verify: check.rows[0],
        hint: "Open the app logged in as ben111611@gmail.com, switch to 台灣帳本, go to Aug 2026, then sync.",
      },
      null,
      2,
    ),
  );

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
