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
- Account-name login (`benedict`) + password; cloud sync when signed in
- Income / expense / **hold（扣住）** offline. Transfer exists only as old rows; new entries are not transfers
- Accounts and categories (expense + income; defaults include meals, 運動, 機車, 請客, 水果; **其他支出 / 其他收入** stay last)
- Soft-delete categories stay deleted across seed + sync
- **Holdings / 存款** — cash, savings, deposits, funds, e-wallets; annual rate with interest preview; pie chart
- Bank expenses can debit a chosen holding
- **Net worth** = holdings only (day-to-day accounts are cash flow; outstanding holds shown as a footnote)
- **待報銷** on expenses; 銷帳 from 待處理. Treat tag (`請客`) is a flag, not a second category
- **每月固定** — salary, rent, subscriptions, and 定期定額 into a fund; optional end month
- Month summary: 花費 / 被扣住 / 實際花掉 / 結餘 (holds stay in that month’s 花費 even after 已退回; refund income does not inflate 結餘)
- Reports: month, year (YTD vs the same day last year), and **全部** from 2020 through today
- Home list from 2020; jump any month; year arrows skip a year; future years stay hidden until a booking exists
- Calendar day view; search notes and amounts（更多 → 搜尋）
- 待處理 inbox for open holds and unreimbursed expenses (not on the home list)
- Monthly budgets; amount keypad (amount **0** allowed, e.g. 請客)
- CSV export; JSON backup; import 豬豬記帳 history into the TWD book (through 2025; occupied months skipped)
- Privacy page + delete signed-in account (`/privacy`, `/delete-account`)
- Daily reminder at a chosen time: home card「今天記了沒」plus an optional system notification. Signed-in devices can also get a Web Push after migration `017` and VAPID env vars (still not a guaranteed alarm on a free Vercel cron)
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

3. In the [Supabase SQL Editor](https://supabase.com/dashboard), run migrations **in order** `001` → `016` (see [SETUP.md](SETUP.md)).

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

Hobby + a private GitHub repo may block Git auto-deploy when the commit author is not the Vercel project owner. Push still backs up the repo; production follows the CLI.

## Sync model

- Writes go to the browser first (`sync_status: pending`).
- When online and signed in: pull remote changes, then push pending rows.
- Soft deletes use `deleted_at`. Pending local deletes are not overwritten by older live remote rows.
- Conflict rule: last-write-wins via `updated_at`.
- Pulls are paged so history past the first thousand rows still downloads. After a schema change that widens the window, the client may full-sync once.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run deploy
```
