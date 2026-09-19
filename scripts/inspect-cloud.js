const { Client } = require("pg");

const c = new Client({
  connectionString: process.env.DB,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  await c.connect();
  const users = await c.query("select id, email from auth.users order by created_at");
  console.log("USERS", JSON.stringify(users.rows, null, 2));

  const books = await c.query(
    "select id, name, currency, user_id from public.books where deleted_at is null order by sort_order",
  );
  console.log("BOOKS", JSON.stringify(books.rows, null, 2));

  const accounts = await c.query(
    "select id, book_id, name, type, user_id from public.accounts where deleted_at is null order by sort_order",
  );
  console.log("ACCOUNTS", JSON.stringify(accounts.rows, null, 2));

  const cats = await c.query(
    "select id, book_id, name, kind from public.categories where deleted_at is null order by kind, sort_order",
  );
  console.log("CATEGORIES", JSON.stringify(cats.rows, null, 2));

  const tx = await c.query(
    "select count(*)::int as n from public.transactions where deleted_at is null",
  );
  console.log("TX_COUNT", tx.rows[0].n);

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
