---
name: craftsmanship-guide
description: >-
  記帳本 (Record) 核心設計規範、日系和紙美學標準、防錯規範與使用者體驗指南。
  在進行 UI 樣式修改、功能調整、配色、排版或新增功能時必備參考。
---

# 記帳本 (Record) 核心設計與工程防錯手冊

## 一、日系和紙美學禁忌與準則

1. **色彩搭配（Color Harmony）**：
   - **基底**：米白宣紙色（`#f3efe6` / `#fffdf8`）。
   - **嚴禁粉紫泥濘色（Dusty Lavender / Muddy Indigo）**：絕對禁止 `bg-indigo-100 text-indigo-950`、`bg-indigo-50`。在米紙底色上呈現淤青混濁感。
   - **嚴禁刺眼高亮黃色（Neon Yellow）**：文字與標記嚴禁使用高反差高飽和亮黃色，改用沉穩溫潤的琥珀色（`amber-600` / `amber-700`）或墨色。
   - **主要按鈕**：俐落深墨色 `bg-[var(--ink)] text-[var(--paper)] rounded-xl font-semibold shadow-xs hover:opacity-90 active:scale-95` 或飽和鮮明寶石色（如 `bg-blue-600 text-white`）。
   - **次要按鈕**：膠囊邊框 `rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)] active:scale-95`。

2. **圖示規範（Icon Consistency）**：
   - 列表統一為圓形微光徽章（`rounded-full !h-7 !w-7`）搭配白色 SVG。
   - 嚴禁方塊包中文字（如方塊「扣」、方塊「轉」）。
   - 「扣住」使用寶石藍 `bg-blue-600` 鎖頭 🔒 SVG，文字一律為 `text-blue-600 dark:text-blue-400 font-semibold`。
   - 「轉帳」使用板岩灰 `bg-slate-600` 雙向箭頭 ⇄ SVG。

3. **使用者習慣與細節**：
   - 預算頁預設為「年預算」。
   - 頂部摘要不顯示「含請客」，只顯示 `實際花掉（不含扣住）`。
   - 「更多」頁面絕對精簡：嚴禁出現「帳本」、「記帳範本」、「帳戶」、「待辦與扣住」、「進階搜尋」，只保留分類、預算、每月固定、帳號設定。
   - 去除重複標題前綴（如已有暫時扣住標籤，不顯示「扣住：電費預繳」，只顯示「電費預繳」）。
   - 移除無上下文不明文案（如「恢復自動」）。
   - 每月定期扣款到期時自動記入。

4. **工程自檢守則**：
   - 每次修改後必須跑 `npm test`（32 測試全數通過）。
   - 必須跑 `npm run build`（打包編譯 0 錯誤）。
   - 用 `git diff` 審查代碼與顏色清理。
