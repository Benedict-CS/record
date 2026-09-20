# Record — simple personal money app (PWA)

English name: **Record** (Chinese UI: **記帳本**).  
Offline-first: Next.js + Dexie (browser storage) + Supabase Auth/Postgres. Syncs when you sign in and go online. Deploy on Vercel.

| Doc | What it is |
|-----|------------|
| [SETUP.md](SETUP.md) | How to set up Supabase + Vercel (Traditional Chinese, step-by-step) |
| [AUTH.md](AUTH.md) | Login / register / sync behaviour |
| [AGENTS.md](AGENTS.md) | Notes for AI coding agents (Next.js rules + this project) |

Live site: https://record.benedicttiong.site

## Features

- **TWD / MYR book switcher** — separate money books per currency
- Income / expense / transfer / **hold（扣住）** offline
- Accounts and categories (expense + income; defaults include meals, 運動, 機車, 請客, 水果; **其他支出 / 其他收入** stay last)
- Soft-delete categories stay deleted across seed + sync
- **Holdings / 存款** — cash, savings, deposits, funds, e-wallets; annual rate with interest preview; pie chart
- **Net worth** = holdings only (day-to-day accounts are cash flow; outstanding holds shown as a footnote)
- Month summary: 花費 / 被扣住 / 實際花掉 / 結餘 (holds stay in that month’s 花費 even after 已退回; refund income does not inflate 結餘)
- Year spend snapshot + reports
- Calendar day view; search notes and amounts（更多 → 搜尋）
- Monthly budgets; amount keypad (amount **0** allowed, e.g. 請客)
- CSV export; Email + password login + cloud sync
- Installable PWA · light UI only (**no dark mode**)

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env and fill Supabase values (optional for local-only):

```bash
cp .env.example .env.local
```

3. In the [Supabase SQL Editor](https://supabase.com/dashboard), run migrations **in order** `001` → `007` (see [SETUP.md](SETUP.md)).

4. Enable **Email** auth in Supabase. Add redirect URL:

- Local: `http://localhost:3000/auth/callback`
- Production: `https://YOUR_DOMAIN/auth/callback`

5. Start:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You can record money without signing in; data stays in the browser.

## Vercel deploy

Preferred (CLI):

```bash
npm run deploy
```

Env vars (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Sync model

- Writes go to the browser first (`sync_status: pending`).
- When online and signed in: pull remote changes, then push pending rows.
- Soft deletes use `deleted_at`. Pending local deletes are not overwritten by older live remote rows.
- Conflict rule: last-write-wins via `updated_at`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run deploy
```
