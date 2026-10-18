const { Client } = require("pg");

const connectionString = process.env.DB;
if (!connectionString) {
  console.error("Missing DB");
  process.exit(1);
}

(async () => {
  const c = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const r = await c.query(
    `select id, book_id, type, amount, note, date, account_id,
            reimbursable_amount, reimbursement_status, deleted_at
     from public.transactions
     where deleted_at is null
       and (
         note ilike '%除濕%'
         or note ilike '%退稅%'
         or (type = 'expense' and amount in (6766, 7666, 6677))
       )
     order by date desc
     limit 20`,
  );
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
