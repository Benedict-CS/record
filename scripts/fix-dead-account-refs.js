const { Client } = require("pg");

const USER = "4197e225-3723-4082-9b28-0b6e65fcd4c6";
const KEEP = "8765897c-1a8c-41ca-82bc-aee87630468e";

const LIVE = {
  cash: "140a51b3-147e-4f98-92a1-ad4c824fbd89",
  bank: "01f32db5-7e6b-4f9a-a215-ebfb86ad069d",
  credit: "085ef8ac-8421-4294-b504-e76c4c33e94f",
};

(async () => {
  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  await c.query("begin");

  // Remap txs on KEEP that point at soft-deleted accounts onto the live
  // same-type account for that book.
  const remap = await c.query(
    `with dead as (
       select t.id as tx_id, a.type
       from public.transactions t
       join public.accounts a on a.id = t.account_id
       where t.user_id = $1
         and t.book_id = $2
         and t.deleted_at is null
         and a.deleted_at is not null
     ),
     live as (
       select type, id
       from public.accounts
       where user_id = $1 and book_id = $2 and deleted_at is null
     )
     update public.transactions t
     set account_id = live.id,
         updated_at = now()
     from dead
     join live on live.type = dead.type
     where t.id = dead.tx_id
     returning t.id, t.account_id`,
    [USER, KEEP],
  );
  console.log("REMAPPED", remap.rowCount, remap.rows.slice(0, 5));

  // Soft-delete any remaining live empty TWD twins (should already be dead).
  const twins = await c.query(
    `update public.books
     set deleted_at = coalesce(deleted_at, now()), updated_at = now()
     where user_id = $1
       and currency = 'TWD'
       and id <> $2
       and deleted_at is null
     returning id`,
    [USER, KEEP],
  );
  console.log("DEAD_TWD_TWINS", twins.rows);

  const check = await c.query(
    `select t.account_id, a.name, a.deleted_at is not null as acc_dead, count(*)::int as n
     from public.transactions t
     left join public.accounts a on a.id = t.account_id
     where t.user_id=$1 and t.book_id=$2 and t.deleted_at is null
       and t.date >= '2026-09-01' and t.date < '2026-10-01'
     group by t.account_id, a.name, a.deleted_at
     order by n desc`,
    [USER, KEEP],
  );
  console.log("SEP_AFTER", check.rows);

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

  await c.query("commit");
  await c.end();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
