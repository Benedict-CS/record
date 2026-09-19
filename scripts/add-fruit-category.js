const { Client } = require("pg");
const crypto = require("crypto");

const USER = "4197e225-3723-4082-9b28-0b6e65fcd4c6";
const BOOKS = [
  "8765897c-1a8c-41ca-82bc-aee87630468e",
  "4e1140bd-1c39-46b0-bfd6-5108b4e9271c",
];
const CLIENT = "add-category-fruit-v1";

(async () => {
  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const stamp = new Date().toISOString();

  for (const bookId of BOOKS) {
    const existing = await c.query(
      `select id from public.categories
       where book_id=$1 and deleted_at is null and name='水果' and kind='expense'`,
      [bookId],
    );
    if (existing.rowCount > 0) {
      console.log("EXISTS", bookId);
      continue;
    }
    const max = await c.query(
      `select coalesce(max(sort_order), -1)::int as m from public.categories
       where book_id=$1 and deleted_at is null and kind='expense'`,
      [bookId],
    );
    const id = crypto.randomUUID();
    await c.query(
      `insert into public.categories (
         id, user_id, book_id, name, kind, icon, color, sort_order,
         updated_at, deleted_at, client_id
       ) values ($1,$2,$3,'水果','expense','leaf','#27ae60',$4,$5,null,$6)`,
      [id, USER, bookId, max.rows[0].m + 1, stamp, CLIENT],
    );
    console.log("ADDED", bookId, id);
  }
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
