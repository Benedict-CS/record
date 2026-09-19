# Agent notes for Record

This repo is **Record** — a simple personal money app (Chinese UI: **記帳本**).  
Prefer the word **Record** in English docs and comments; do **not** call the product “Ledger”.

- Live: https://record.benedicttiong.site  
- Setup: [SETUP.md](SETUP.md) · Auth: [AUTH.md](AUTH.md) · Overview: [README.md](README.md)  
- Deploy: `npm run deploy` (Vercel CLI; do not rely on Hobby private-repo auto-deploy)  
- Stack: Next.js + Dexie (IndexedDB) + Supabase  

Some internal keys still use the old `ledger_*` prefix (browser storage / DB name) so existing user data is not wiped. Do not rename those without a migration plan.

@AGENTS.md
