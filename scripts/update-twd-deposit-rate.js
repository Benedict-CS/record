const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const r = await c.query(
    `update public.holdings
     set annual_rate = 1.715,
         compounding = 'simple',
         note = $1,
         updated_at = now(),
         client_id = 'update-twd-deposit-rate-v1'
     where user_id = '4197e225-3723-4082-9b28-0b6e65fcd4c6'
       and book_id = '8765897c-1a8c-41ca-82bc-aee87630468e'
       and deleted_at is null
       and name = '台新定存'
     returning name, amount::float as amount, annual_rate::float as rate, compounding, note`,
    ["定存一年期機動 1.715%（牌告 2026/09/18）"],
  );
  console.log(r.rows);
  const amount = r.rows[0]?.amount ?? 0;
  const yearly = (amount * 1.715) / 100;
  console.log("EST_YEARLY", yearly, "MONTHLY", yearly / 12);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
