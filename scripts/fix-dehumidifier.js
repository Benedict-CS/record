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
    `update public.transactions
     set amount = 7666,
         reimbursable_amount = 900,
         reimbursement_status = 'received',
         note = '除濕機',
         updated_at = now(),
         client_id = 'fix-dehumidifier-reimb'
     where id = '91ea3cf3-9602-4a07-8635-ea3fd6664f94'
     returning id, amount, note, reimbursable_amount, reimbursement_status, updated_at`,
  );
  console.log(JSON.stringify(r.rows[0], null, 2));
  await c.end();
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
