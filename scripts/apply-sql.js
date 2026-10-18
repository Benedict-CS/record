const { Client } = require("pg");
const fs = require("fs");

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error("Usage: node apply-sql.js <path.sql>");
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const connectionString = process.env.DB;
if (!connectionString) {
  console.error("Missing DB env");
  process.exit(1);
}

(async () => {
  const c = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  await c.query(sql);
  const cols = await c.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'transactions'
       and column_name like 'reimb%'
     order by 1`,
  );
  console.log("cols=" + cols.rows.map((r) => r.column_name).join(","));
  await c.end();
  console.log("OK");
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
