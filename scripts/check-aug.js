const { Client } = require("pg");

const USER = "4197e225-3723-4082-9b28-0b6e65fcd4c6";
const KEEP = "8765897c-1a8c-41ca-82bc-aee87630468e";

(async () => {
  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const aug = await c.query(
    `select
       count(*) filter (where deleted_at is null)::int as live,
       count(*)::int as all_rows,
       coalesce(sum(amount) filter (where deleted_at is null and type='expense'),0)::float as expense,
       coalesce(sum(amount) filter (where deleted_at is null and type='income'),0)::float as income
     from public.transactions
     where user_id=$1 and book_id=$2
       and date >= '2026-08-01' and date < '2026-09-01'`,
    [USER, KEEP],
  );
  console.log("AUG_KEEP", aug.rows[0]);

  const sample = await c.query(
    `select date, type, amount, note, deleted_at is not null as dead
     from public.transactions
     where user_id=$1 and book_id=$2
       and date >= '2026-08-01' and date < '2026-09-01'
     order by date desc, updated_at desc
     limit 15`,
    [USER, KEEP],
  );
  console.log("SAMPLE", sample.rows);

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
