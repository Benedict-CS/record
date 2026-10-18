const { Client } = require("pg");

const USER = "4197e225-3723-4082-9b28-0b6e65fcd4c6";

(async () => {
  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const books = await c.query(
    `select id, name, currency from public.books
     where deleted_at is null and user_id = $1 order by sort_order`,
    [USER],
  );
  console.log("BOOKS", books.rows);
  for (const row of books.rows) {
    const h = await c.query(
      `select id, name, kind, amount, annual_rate, compounding, institution, note
       from public.holdings
       where book_id = $1 and deleted_at is null order by sort_order`,
      [row.id],
    );
    console.log("HOLDINGS", row.currency, h.rows);
    const a = await c.query(
      `select id, name, type, opening_balance from public.accounts
       where book_id = $1 and deleted_at is null order by sort_order`,
      [row.id],
    );
    console.log("ACCOUNTS", row.currency, a.rows);
  }
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
