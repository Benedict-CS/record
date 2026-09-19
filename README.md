# Ledger — Offline-first personal accounting PWA

Next.js + Dexie (IndexedDB) + Supabase Auth/Postgres. Works offline first; syncs when you sign in and go online. Deploy on Vercel.

**Full setup (where to click, credentials, migrations):** see [SETUP.md](SETUP.md) (Traditional Chinese, step-by-step).

## Features

- **TWD / MYR book switcher** — separate ledgers per currency book
- Add income / expense / transfer offline
- Accounts and categories (expense + **income categories**, with defaults; add your own)
- **Holdings / savings** — cash, bank savings, time deposits, funds, e-wallets (ShopeePay, Touch n Go); custom kinds; annual rate with monthly/yearly interest
- Monthly summary and transaction list
- Reports (category breakdown / monthly totals)
- Calendar day view of transactions
- Search notes and amounts
- Monthly budgets (overall + per category) with progress
- Amount keypad for quick entry
- CSV export (month or year, client-side download)
- Optional Email magic-link login + cloud sync
- Installable PWA
- Light UI only (**no dark mode**)

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file and fill in Supabase values (optional for local-only use):

```bash
cp .env.example .env.local
```

3. In the [Supabase SQL Editor](https://supabase.com/dashboard), run migrations **in order**:

- [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql)
- [`supabase/migrations/002_category_color_and_budgets.sql`](supabase/migrations/002_category_color_and_budgets.sql)
- [`supabase/migrations/003_books.sql`](supabase/migrations/003_books.sql)
- [`supabase/migrations/004_templates_and_balances.sql`](supabase/migrations/004_templates_and_balances.sql)
- [`supabase/migrations/005_holdings.sql`](supabase/migrations/005_holdings.sql)

Details: [SETUP.md](SETUP.md).

4. Enable **Email** auth in Supabase. Add redirect URL:

- Local: `http://localhost:3000/auth/callback`
- Production: `https://YOUR_DOMAIN/auth/callback`

5. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You can record transactions without signing in; data stays in IndexedDB.

## Vercel deploy

1. Push this repo and import it in Vercel.
2. Set environment variables (Production + Preview):

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

3. Deploy. Update Supabase Auth redirect URLs to include `https://YOUR_VERCEL_DOMAIN/auth/callback`.

Step-by-step: [SETUP.md](SETUP.md).

## Sync model

- Writes always go to IndexedDB first (`sync_status: pending`).
- When online and signed in: pull remote changes, then upsert pending rows (books, accounts, categories, transactions, budgets, templates, holdings).
- Soft deletes use `deleted_at`.
- Conflict rule for personal use: last-write-wins via `updated_at` (local pending rows are pushed).

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
```
