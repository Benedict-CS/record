const { Client } = require("pg");

const USER = "4197e225-3723-4082-9b28-0b6e65fcd4c6";
const KEEP = "8765897c-1a8c-41ca-82bc-aee87630468e";

(async () => {
  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const orphan = await c.query(
    `select t.account_id, a.name, a.deleted_at is not null as acc_dead, count(*)::int as n
     from public.transactions t
     left join public.accounts a on a.id = t.account_id
     where t.user_id=$1 and t.book_id=$2 and t.deleted_at is null
       and t.date >= '2026-09-01' and t.date < '2026-10-01'
     group by t.account_id, a.name, a.deleted_at
     order by n desc`,
    [USER, KEEP],
  );
  console.log("SEP_ACCOUNT_USAGE", orphan.rows);

  const liveAcc = await c.query(
    `select id, name, type from public.accounts
     where user_id=$1 and book_id=$2 and deleted_at is null
     order by sort_order`,
    [USER, KEEP],
  );
  console.log("LIVE_ACCOUNTS", liveAcc.rows);

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
