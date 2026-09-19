const { Client } = require("pg");

const BOOKS = [
  "8765897c-1a8c-41ca-82bc-aee87630468e",
  "4e1140bd-1c39-46b0-bfd6-5108b4e9271c",
];

(async () => {
  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const stamp = new Date().toISOString();

  for (const bookId of BOOKS) {
    for (const kind of ["expense", "income"]) {
      const pinnedName = kind === "expense" ? "其他支出" : "其他收入";
      const rows = await c.query(
        `select id, name, sort_order from public.categories
         where book_id=$1 and kind=$2 and deleted_at is null
         order by
           case when name=$3 then 1 else 0 end,
           sort_order,
           name`,
        [bookId, kind, pinnedName],
      );
      for (let i = 0; i < rows.rows.length; i += 1) {
        const row = rows.rows[i];
        if (row.sort_order === i) continue;
        await c.query(
          `update public.categories
           set sort_order=$1, updated_at=$2, client_id='pin-catch-all-v1'
           where id=$3`,
          [i, stamp, row.id],
        );
        console.log("FIX", bookId, kind, row.name, row.sort_order, "->", i);
      }
    }
  }
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
