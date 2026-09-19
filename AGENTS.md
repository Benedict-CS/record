# Record — notes for coding agents

**Product English name: Record** (not “Ledger”). Chinese UI brand: **記帳本**.

Before changing product copy or docs, keep the name consistent: Record / 記帳本.

Useful paths:

- App UI: `src/components/`
- Local DB + CRUD: `src/lib/db/`
- Sync: `src/lib/sync/engine.ts`
- Migrations: `supabase/migrations/` (`001` … `006`)

Deploy with `npm run deploy`. Prefer reading Next.js docs under `node_modules/next/dist/docs/` when APIs differ from older Next.js.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
