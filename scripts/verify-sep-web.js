const { Client } = require("pg");

const USER = "4197e225-3723-4082-9b28-0b6e65fcd4c6";
const KEEP = "8765897c-1a8c-41ca-82bc-aee87630468e";

(async () => {
  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const books = await c.query(
    `select id, name, currency, deleted_at is not null as dead, updated_at
     from public.books where user_id=$1
     order by currency, deleted_at nulls first`,
    [USER],
  );
  console.log("BOOKS", JSON.stringify(books.rows, null, 2));

  const twin = await c.query(
    `select book_id,
            count(*) filter (where deleted_at is null)::int as live_tx
     from public.transactions where user_id=$1
     group by book_id order by live_tx desc`,
    [USER],
  );
  console.log("TX_BY_BOOK", twin.rows);

  const sep = await c.query(
    `select
       count(*) filter (where deleted_at is null)::int as n,
       coalesce(sum(amount) filter (where deleted_at is null and type='expense'),0)::float as expense,
       coalesce(sum(amount) filter (where deleted_at is null and type='income'),0)::float as income
     from public.transactions
     where user_id=$1 and book_id=$2
       and date >= '2026-09-01' and date < '2026-10-01'`,
    [USER, KEEP],
  );
  console.log("SEP_KEEP", sep.rows[0]);

  const acc = await c.query(
    `select id, name, type, deleted_at is not null as dead
     from public.accounts where user_id=$1 and book_id=$2
     order by sort_order`,
    [USER, KEEP],
  );
  console.log("ACCOUNTS_KEEP", acc.rows);

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
