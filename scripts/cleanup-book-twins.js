const { Client } = require("pg");

const USER = "4197e225-3723-4082-9b28-0b6e65fcd4c6";
const KEEP = "8765897c-1a8c-41ca-82bc-aee87630468e";

(async () => {
  const c = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const ts = new Date().toISOString();
  const report = {
    moved: [],
    softDeletedBooks: [],
    myrKept: null,
    sepBefore: null,
    sepAfter: null,
    notes: [],
  };

  const live = await c.query(
    `select b.id, b.name, b.currency, b.updated_at,
       (select count(*)::int from public.transactions t
         where t.book_id=b.id and t.deleted_at is null) as live_tx,
       (select count(*)::int from public.accounts a
         where a.book_id=b.id and a.deleted_at is null) as live_acc,
       (select count(*)::int from public.categories cat
         where cat.book_id=b.id and cat.deleted_at is null) as live_cat
     from public.books b
     where b.user_id=$1 and b.deleted_at is null
     order by b.currency, live_tx desc, b.updated_at`,
    [USER],
  );
  console.log("LIVE_BEFORE", JSON.stringify(live.rows, null, 2));

  const sep0 = await c.query(
    `select
       count(*) filter (where deleted_at is null)::int as n,
       coalesce(sum(amount) filter (where deleted_at is null and type='expense'),0)::float as expense,
       coalesce(sum(amount) filter (where deleted_at is null and type='income'),0)::float as income
     from public.transactions
     where user_id=$1 and book_id=$2
       and date >= '2026-09-01' and date < '2026-10-01'`,
    [USER, KEEP],
  );
  report.sepBefore = sep0.rows[0];

  await c.query("begin");
  try {
    // --- TWD twins: move live children onto KEEP, then soft-delete twin books ---
    const twdTwins = live.rows.filter((b) => b.currency === "TWD" && b.id !== KEEP);
    for (const twin of twdTwins) {
      for (const table of ["transactions", "accounts", "categories"]) {
        const r = await c.query(
          `update public.${table}
           set book_id=$1, updated_at=$2
           where user_id=$3 and book_id=$4 and deleted_at is null`,
          [KEEP, ts, USER, twin.id],
        );
        if (r.rowCount) {
          report.moved.push({ from: twin.id, to: KEEP, table, n: r.rowCount });
        }
      }
      const del = await c.query(
        `update public.books set deleted_at=$1, updated_at=$1
         where id=$2 and user_id=$3 and deleted_at is null`,
        [ts, twin.id, USER],
      );
      if (del.rowCount) {
        report.softDeletedBooks.push({
          id: twin.id,
          name: twin.name,
          currency: twin.currency,
          reason: "twd_twin",
        });
      }
    }
    if (!twdTwins.length) {
      report.notes.push("No live TWD twins (KEEP already sole live TWD).");
    }

    // --- MYR twins: keep the one with most live txs ---
    const myr = live.rows
      .filter((b) => b.currency === "MYR")
      .slice()
      .sort(
        (a, b) =>
          b.live_tx - a.live_tx || String(a.updated_at).localeCompare(String(b.updated_at)),
      );
    if (myr.length > 1) {
      const keepMyr = myr[0];
      report.myrKept = keepMyr.id;
      for (const twin of myr.slice(1)) {
        for (const table of ["transactions", "accounts", "categories"]) {
          const r = await c.query(
            `update public.${table}
             set book_id=$1, updated_at=$2
             where user_id=$3 and book_id=$4 and deleted_at is null`,
            [keepMyr.id, ts, USER, twin.id],
          );
          if (r.rowCount) {
            report.moved.push({
              from: twin.id,
              to: keepMyr.id,
              table,
              n: r.rowCount,
            });
          }
        }
        const del = await c.query(
          `update public.books set deleted_at=$1, updated_at=$1
           where id=$2 and user_id=$3 and deleted_at is null`,
          [ts, twin.id, USER],
        );
        if (del.rowCount) {
          report.softDeletedBooks.push({
            id: twin.id,
            name: twin.name,
            currency: twin.currency,
            reason: "myr_twin",
          });
        }
      }
    } else if (myr.length === 1) {
      report.myrKept = myr[0].id;
      report.notes.push("Only one live MYR book; no MYR twin soft-delete needed.");
    } else {
      report.notes.push("No live MYR books.");
    }

    // --- Soft-delete remaining live empty seed books that would fork ---
    // (any live non-KEEP / non-kept-MYR book with 0 txs)
    const liveNow = await c.query(
      `select b.id, b.name, b.currency,
         (select count(*)::int from public.transactions t
           where t.book_id=b.id and t.deleted_at is null) as live_tx
       from public.books b
       where b.user_id=$1 and b.deleted_at is null`,
      [USER],
    );
    let emptySeedCount = 0;
    for (const b of liveNow.rows) {
      if (b.id === KEEP) continue;
      if (report.myrKept && b.id === report.myrKept) continue;
      if (b.live_tx !== 0) continue;
      await c.query(
        `update public.accounts set deleted_at=$1, updated_at=$1
         where user_id=$2 and book_id=$3 and deleted_at is null`,
        [ts, USER, b.id],
      );
      await c.query(
        `update public.categories set deleted_at=$1, updated_at=$1
         where user_id=$2 and book_id=$3 and deleted_at is null`,
        [ts, USER, b.id],
      );
      const del = await c.query(
        `update public.books set deleted_at=$1, updated_at=$1
         where id=$2 and user_id=$3 and deleted_at is null`,
        [ts, b.id, USER],
      );
      if (del.rowCount) {
        emptySeedCount += 1;
        report.softDeletedBooks.push({
          id: b.id,
          name: b.name,
          currency: b.currency,
          reason: "empty_seed_fork",
        });
      }
    }
    if (!emptySeedCount) {
      report.notes.push("No additional empty live seed books to soft-delete.");
    }

    // Soft-delete live accounts/categories still hanging on already-dead books
    const accOrphans = await c.query(
      `update public.accounts a set deleted_at=$1, updated_at=$1
       from public.books b
       where a.book_id=b.id and a.user_id=$2
         and a.deleted_at is null and b.deleted_at is not null`,
      [ts, USER],
    );
    if (accOrphans.rowCount) {
      report.notes.push(
        `Soft-deleted ${accOrphans.rowCount} live accounts on dead books.`,
      );
    }
    const catOrphans = await c.query(
      `update public.categories cat set deleted_at=$1, updated_at=$1
       from public.books b
       where cat.book_id=b.id and cat.user_id=$2
         and cat.deleted_at is null and b.deleted_at is not null`,
      [ts, USER],
    );
    if (catOrphans.rowCount) {
      report.notes.push(
        `Soft-deleted ${catOrphans.rowCount} live categories on dead books.`,
      );
    }

    // Ensure Sep income=0 if any slipped in
    if (report.sepBefore.income !== 0) {
      const inc = await c.query(
        `update public.transactions set deleted_at=$1, updated_at=$1
         where user_id=$2 and book_id=$3 and deleted_at is null
           and type='income'
           and date >= '2026-09-01' and date < '2026-10-01'`,
        [ts, USER, KEEP],
      );
      report.notes.push(`Soft-deleted ${inc.rowCount} Sep income txs on KEEP.`);
    }

    const sep1 = await c.query(
      `select
         count(*) filter (where deleted_at is null)::int as n,
         coalesce(sum(amount) filter (where deleted_at is null and type='expense'),0)::float as expense,
         coalesce(sum(amount) filter (where deleted_at is null and type='income'),0)::float as income
       from public.transactions
       where user_id=$1 and book_id=$2
         and date >= '2026-09-01' and date < '2026-10-01'`,
      [USER, KEEP],
    );
    report.sepAfter = sep1.rows[0];
    if (Math.abs(report.sepAfter.expense - 24910) > 0.5 || report.sepAfter.income !== 0) {
      report.notes.push(
        `WARNING: Sep KEEP expense=${report.sepAfter.expense} income=${report.sepAfter.income} (expected ~24910 / 0)`,
      );
    } else {
      report.notes.push("Sep KEEP totals OK (expense≈24910, income=0).");
    }

    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  }

  const liveAfter = await c.query(
    `select b.id, b.name, b.currency,
       (select count(*)::int from public.transactions t
         where t.book_id=b.id and t.deleted_at is null) as live_tx,
       (select count(*)::int from public.accounts a
         where a.book_id=b.id and a.deleted_at is null) as live_acc
     from public.books b
     where b.user_id=$1 and b.deleted_at is null
     order by b.currency`,
    [USER],
  );
  console.log("LIVE_AFTER", JSON.stringify(liveAfter.rows, null, 2));
  console.log("REPORT", JSON.stringify(report, null, 2));

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
