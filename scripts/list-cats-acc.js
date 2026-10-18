const { Client } = require("pg");

const USER = "4197e225-3723-4082-9b28-0b6e65fcd4c6";
const KEEP = "8765897c-1a8c-41ca-82bc-aee87630468e";

(async () => {
  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const cats = await c.query(
    `select id, name, kind from public.categories
     where user_id=$1 and book_id=$2 and deleted_at is null
     order by kind, sort_order`,
    [USER, KEEP],
  );
  console.log("CATS", JSON.stringify(cats.rows, null, 2));

  const acc = await c.query(
    `select id, name, type from public.accounts
     where user_id=$1 and book_id=$2 and deleted_at is null
     order by sort_order`,
    [USER, KEEP],
  );
  console.log("ACC", JSON.stringify(acc.rows, null, 2));

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
