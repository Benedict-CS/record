/**
 * Import Feb / Mar / May 2026 screenshot rows into the TWD book.
 * Run: $env:DB="..."; node scripts/import-feb-mar-may-2026.js
 */
const { Client } = require("pg");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const USER = "4197e225-3723-4082-9b28-0b6e65fcd4c6";
const BOOK = "8765897c-1a8c-41ca-82bc-aee87630468e";
const CLIENT = "import-feb-mar-may-2026-v1";

const ACC = {
  cash: "140a51b3-147e-4f98-92a1-ad4c824fbd89",
  bank: "01f32db5-7e6b-4f9a-a215-ebfb86ad069d",
};

const CAT = {
  早餐: "08ebeef5-0616-4ac6-bf53-293eaaa18081",
  午餐: "0407247d-f524-4943-a73c-123c419d693f",
  晚餐: "24fc3a19-7da9-4ad0-bac3-7a52d16c8be4",
  飲料零食: "1b5f709e-2ae7-408e-be34-1fe34cd027c6",
  交通: "0a986400-8353-4017-af93-d671566f2008",
  電話費: "11486044-fabf-4482-ab6c-031e76a97d2a",
  機車: "066ceca7-33e7-4da3-bc37-34987feb660a",
  住宿費: "0378ce00-4e70-4ca6-bf98-4bffd514b8d3",
  運動: "10e95348-9dc3-4836-a9fd-09d36160842f",
  房租水電: "041690cc-e595-4c1e-b405-1cbd2b384f6d",
  購物: "06c72b66-bc37-4275-9eb3-6be88e7429f1",
  娛樂: "115987a3-195c-46ec-a42b-03b443ec31fe",
  學習: "36847f33-90e0-4647-81f5-4477378824f7",
  醫療: "0d083069-f008-4e19-9916-dc0d2810cca2",
  水果: "1c906c01-4839-4f8c-a765-af29709b40f8",
  請客: "96681267-8bf1-41c9-b99f-264d22042822",
  其他支出: "1320678d-62cb-4a57-a40c-5daa02dc1980",
};

const MONTHS = [
  {
    label: "2026-02",
    start: "2026-02-01",
    end: "2026-03-01",
    expectExpense: 31362,
    file: "feb-2026-rows.json",
  },
  {
    label: "2026-03",
    start: "2026-03-01",
    end: "2026-04-01",
    expectExpense: 492,
    file: "mar-2026-rows.json",
  },
  {
    label: "2026-05",
    start: "2026-05-01",
    end: "2026-06-01",
    // Screenshot header 6677; line items from two scrolls sum to 6637 (gap 40).
    expectExpense: 6637,
    file: "may-2026-rows.json",
  },
];

function mapCategory(category) {
  const c = (category || "").trim();
  if (CAT[c]) return CAT[c];
  if (c === "宿舍" || c === "宿舍費") return CAT.住宿費;
  if (c === "進修" || c === "學費") return CAT.學習;
  if (c === "零食" || c === "小吃" || c === "點心" || c === "飲料") {
    return CAT.飲料零食;
  }
  if (c === "其他" || c === "其它" || c === "雜項" || c === "生活費") {
    return CAT.其他支出;
  }
  return CAT.其他支出;
}

function mapAccount(category, amount) {
  if (
    category === "宿舍" ||
    category === "進修" ||
    category === "機車" ||
    amount >= 2000
  ) {
    return ACC.bank;
  }
  if (category === "電話費" || category === "交通") return ACC.bank;
  return ACC.cash;
}

(async () => {
  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  await c.query("begin");

  const stamp = new Date().toISOString();
  const report = [];

  for (const month of MONTHS) {
    const rows = JSON.parse(
      fs.readFileSync(path.join(__dirname, month.file), "utf8"),
    );
    const sum = rows.reduce((s, r) => s + Number(r.amount), 0);
    if (sum !== month.expectExpense) {
      throw new Error(
        `${month.label} sum ${sum} != expect ${month.expectExpense}`,
      );
    }

    const wiped = await c.query(
      `update public.transactions
       set deleted_at = coalesce(deleted_at, now()),
           updated_at = now(),
           client_id = $3
       where user_id = $1 and book_id = $2
         and date >= $4 and date < $5
         and deleted_at is null
       returning id`,
      [USER, BOOK, CLIENT, month.start, month.end],
    );

    let inserted = 0;
    for (const row of rows) {
      await c.query(
        `insert into public.transactions (
           id, user_id, book_id, type, amount, date, note,
           account_id, category_id, transfer_account_id,
           hold_status, release_transaction_id,
           updated_at, deleted_at, client_id
         ) values (
           $1,$2,$3,'expense',$4,$5,$6,$7,$8,null,null,null,$9,null,$10
         )`,
        [
          crypto.randomUUID(),
          USER,
          BOOK,
          row.amount,
          row.date,
          row.note || "",
          mapAccount(row.category, row.amount),
          mapCategory(row.category),
          stamp,
          CLIENT,
        ],
      );
      inserted += 1;
    }

    report.push({
      month: month.label,
      wiped: wiped.rowCount,
      inserted,
      expense: sum,
    });
  }

  await c.query("commit");
  console.log(JSON.stringify(report, null, 2));
  await c.end();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
