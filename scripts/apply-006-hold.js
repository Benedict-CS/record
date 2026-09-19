const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

(async () => {
  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const sql = fs.readFileSync(
    path.join(__dirname, "006_hold_transactions.sql"),
    "utf8",
  );
  await c.query(sql);
  const r = await c.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='transactions'
       and column_name in ('hold_status','release_transaction_id')
     order by column_name`,
  );
  console.log("MIGRATION_OK", r.rows);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
