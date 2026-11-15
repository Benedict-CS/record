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

1. **色彩搭配：乾淨好看淺色系，按鈕底色絕對不能是深色**：
   - ❌ **按鈕底色不能是深色**！嚴禁使用黑色塊（`bg-[var(--ink)] text-white`）或深藍黑塊（`bg-blue-600 text-white`）充當按鈕或選籤。在淺色紙質底色上會如突兀黑斑。
   - 所有按鈕（退回、銷帳、已還、分頁標籤等）一律採用**柔和淺色底 + 1px 精緻邊框 + 飽和文字**（如 `bg-[#F0F7FF] text-[#2563EB] border border-[#BFDBFE]`）。
   - ❌ **絕對禁止泥濘/粉濁淡紫色（Dusty Lavender / Muddy Indigo）**。
   - ❌ **絕對禁止刺眼高亮黃色（Neon / Bright Yellow）**。
   - ❌ **嚴禁系統深色模式污染**：Tailwind 配置 `@variant dark (&:where(.dark, .dark *));`，禁止被 OS dark mode 自動變黑。
2. **更多頁面（/more）絕對精簡鐵則**：
   - ❌ 嚴格禁止在「更多」出現：「帳本」、「記帳範本」、「帳戶」、「待辦與扣住」、「進階搜尋」。
   - 僅保留核心：常用管理（分類、預算、每月固定）與帳號設定，絕不擅自添加多餘入口。
3. **列表圖示規範**：
   - 一律使用「圓形徽章 + 白色 SVG」（`rounded-full !h-7 !w-7`），嚴禁方塊包中文字（如方塊「扣」、方塊「轉」）。
4. **功能與排版習慣**：
   - 預算頁預設以「年預算」為準。頂部摘要只顯示 `實際花掉（不含扣住）`，不顯示「含請客」。
   - 定期扣款到達日期時必須自動入帳。
5. **工程自檢鐵則**：
   - 每次提交前必須跑 `npm test`（32 測試全過）與 `npm run build`（打包編譯零錯誤）。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
