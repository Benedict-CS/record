# Record — notes for coding agents

**Product English name: Record** (not “Ledger”). Chinese UI brand: **記帳本**.

Before changing product copy or docs, keep the name consistent: Record / 記帳本.

Useful paths:

- App UI: `src/components/`
- Local DB + CRUD: `src/lib/db/`
- Recurring posts: `src/lib/db/recurring-post.ts`
- Reports / year range: `src/components/ReportsPage.tsx`, `src/lib/period-jump.ts`
- Sync: `src/lib/sync/engine.ts`
- Migrations: `supabase/migrations/` (`001` … `022`)

Deploy with `npm run deploy`. Prefer reading Next.js docs under `node_modules/next/dist/docs/` when APIs differ from older Next.js.

## ⚠️ 核心設計美學與自檢鐵則（Core Craftsmanship & Design Guidelines）

詳細規範請參閱 `.agents/rules/design-and-craftsmanship.md`。每次修改必須遵守以下原則：

1. **視覺色彩禁區**：
   - ❌ **絕對禁止泥濘/粉濁淡紫色（Dusty Lavender / Muddy Indigo）**，如 `bg-indigo-100 text-indigo-950` 等淡紫粉灰色塊。在日系米紙背景上會如瘀青般髒濁。
   - ❌ **絕對禁止刺眼高亮黃色（Neon / Bright Yellow）**，淺色底對比極差刺眼。標記提醒一律使用沉穩琥珀色（`amber-600` / `amber-700`）或深墨色。
2. **按鈕階層**：
   - **主要按鈕**：俐落深墨色 `bg-[var(--ink)] text-[var(--paper)] rounded-xl font-semibold shadow-xs hover:opacity-90 active:scale-95 transition` 或飽和鮮明寶石色（如 `bg-blue-600 text-white`、`bg-emerald-700 text-white`）。
   - **次要按鈕**：邊框膠囊按鈕 `rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)] active:scale-95 transition`。
   - **微觸控反饋**：所有可點擊按鈕一律標註 `active:scale-95`。
3. **列表圖示規範**：
   - 一律使用「圓形微光徽章 + 白色 SVG」（`rounded-full !h-7 !w-7`）。
   - ❌ **絕對禁止使用方塊包中文字（如方塊「扣」、方塊「轉」）**。
   - 「扣住」一律為深海寶石藍 `bg-blue-600 text-white` 鎖頭 🔒 SVG，金額與文字為 `text-blue-600 dark:text-blue-400 font-semibold`。
   - 「轉帳」為板岩灰 `bg-slate-600 text-white` 雙向箭頭 ⇄ SVG。
4. **功能與排版習慣**：
   - 預算頁預設以「年預算」為準。頂部摘要只顯示 `實際花掉（不含扣住）`，不顯示「含請客」。
   - 清理重複標題贅詞（如已有「暫時扣住」標籤，標題只顯示「電費預繳」，不顯示「扣住：電費預繳」）。
   - 移除無上下文的怪異詞彙（如「恢復自動」）。
   - 定期扣款到達日期時必須自動入帳。
5. **工程自檢鐵則**：
   - 每次提交前必須跑 `npm test`（32 測試全過）與 `npm run build`（打包編譯零錯誤）。
   - 審查 JSX 標籤完整度，嚴禁重複閉合標籤。
   - 使用 `git diff` 審查代碼，杜絕殘留樣式。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
