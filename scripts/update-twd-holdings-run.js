const { Client } = require("pg");
const USER = "4197e225-3723-4082-9b28-0b6e65fcd4c6";
const BOOK = "8765897c-1a8c-41ca-82bc-aee87630468e";
const CLIENT = "update-twd-holdings-v2";
const AMOUNTS = { "永豐": 1010, "郵局": 1287, "台新": 5017, "台新定存": 59000, "國泰": 3595, "現金": 1000 };
(async () => {
  const expected = Object.values(AMOUNTS).reduce((s, n) => s + n, 0);
  if (expected !== 70909) throw new Error("sum " + expected);
  const c = new Client({ connectionString: process.env.DB, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("begin");
  const stamp = new Date().toISOString();
  for (const [name, amount] of Object.entries(AMOUNTS)) {
    const r = await c.query(
      `update public.holdings set amount=$1, updated_at=$2, client_id=$3
       where user_id=$4 and book_id=$5 and deleted_at is null and name=$6
       returning id, name, amount`,
      [amount, stamp, CLIENT, USER, BOOK, name]
    );
    if (r.rowCount !== 1) throw new Error(name + " rows=" + r.rowCount);
    console.log("OK", r.rows[0].name, Number(r.rows[0].amount));
  }
  const check = await c.query(
    `select coalesce(sum(amount),0)::float as total from public.holdings
     where user_id=$1 and book_id=$2 and deleted_at is null`,
    [USER, BOOK]
  );
  console.log("TOTAL", check.rows[0].total);
  if (check.rows[0].total !== 70909) throw new Error("bad total");
  await c.query("commit");
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
