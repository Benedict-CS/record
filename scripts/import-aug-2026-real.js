const { Client } = require("pg");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const USER = "4197e225-3723-4082-9b28-0b6e65fcd4c6";
const BOOK = "8765897c-1a8c-41ca-82bc-aee87630468e";
const CLIENT = "import-aug-2026-screenshot-v1";

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
  運動: "10e95348-9dc3-4836-a9fd-09d36160842f",
  房租水電: "041690cc-e595-4c1e-b405-1cbd2b384f6d",
  購物: "06c72b66-bc37-4275-9eb3-6be88e7429f1",
  其他支出: "1320678d-62cb-4a57-a40c-5daa02dc1980",
};

/** OCR from user August screenshot; expense sum must equal header. */
const ROWS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "aug-2026-rows.json"), "utf8"),
);

function mapCategory(category, note) {
  const n = note || "";
  if (category === "早餐") return CAT.早餐;
  if (category === "午餐") return CAT.午餐;
  if (category === "晚餐") return CAT.晚餐;
  if (category === "交通") return CAT.交通;
  if (category === "宿舍" || n.includes("房租")) return CAT.房租水電;
  if (n.includes("游泳") || n.includes("健身")) return CAT.運動;
  if (n.includes("除濕") || n.includes("全聯") && category === "其他")
    return CAT.購物;
  if (n.includes("除濕機")) return CAT.購物;
  return CAT.其他支出;
}

function mapAccount(category, note, amount) {
  if (category === "宿舍" || (note || "").includes("房租") || amount >= 2000) {
    return ACC.bank;
  }
  if ((note || "").includes("悠遊卡") || (note || "").includes("domain")) {
    return ACC.bank;
  }
  if ((note || "").includes("除濕機")) return ACC.bank;
  if ((note || "").includes("居留證") && amount >= 500) return ACC.bank;
  return ACC.cash;
}

(async () => {
  const expense = ROWS.filter((r) => r.type === "expense").reduce(
    (s, r) => s + r.amount,
    0,
  );
  const income = ROWS.filter((r) => r.type === "income").reduce(
    (s, r) => s + r.amount,
    0,
  );
  console.log("PRECHECK", { n: ROWS.length, expense, income });

  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  await c.query("begin");

  // Soft-delete any leftover Aug rows on KEEP (demo or partial).
  const wiped = await c.query(
    `update public.transactions
     set deleted_at = coalesce(deleted_at, now()),
         updated_at = now(),
         client_id = $3
     where user_id = $1 and book_id = $2
       and date >= '2026-08-01' and date < '2026-09-01'
       and deleted_at is null
     returning id`,
    [USER, BOOK, CLIENT],
  );
  console.log("WIPED_LIVE_AUG", wiped.rowCount);

  const stamp = new Date().toISOString();
  let inserted = 0;
  for (const row of ROWS) {
    const id = crypto.randomUUID();
    const categoryId = mapCategory(row.category, row.note);
    const accountId = mapAccount(row.category, row.note, row.amount);
    await c.query(
      `insert into public.transactions (
         id, user_id, book_id, type, amount, date, note,
         account_id, category_id, transfer_account_id,
         updated_at, deleted_at, client_id
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,null,$10,null,$11
       )`,
      [
        id,
        USER,
        BOOK,
        row.type,
        row.amount,
        row.date,
        row.note || "",
        accountId,
        categoryId,
        stamp,
        CLIENT,
      ],
    );
    inserted += 1;
  }

  const check = await c.query(
    `select
       count(*) filter (where deleted_at is null)::int as n,
       coalesce(sum(amount) filter (where deleted_at is null and type='expense'),0)::float as expense,
       coalesce(sum(amount) filter (where deleted_at is null and type='income'),0)::float as income
     from public.transactions
     where user_id=$1 and book_id=$2
       and date >= '2026-08-01' and date < '2026-09-01'`,
    [USER, BOOK],
  );
  console.log("AUG_AFTER", check.rows[0], "inserted", inserted);

  await c.query("commit");
  await c.end();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
