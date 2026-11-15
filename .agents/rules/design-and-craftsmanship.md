# 記帳本 (Record) 核心設計規範、美學標準與開發自檢守則

本守則為本專案最高優先級規範。所有參與本專案的 AI 代理人與工程師必須嚴格遵守，杜絕重複犯錯。

---

## 一、視覺與美學規範（日系和紙極簡風格）

### 1. 基底底色與視覺調性
- **調性**：日系溫潤極簡、和紙（Washi Paper）手感、安靜不喧鬧、高質感。
- **背景色**：米白宣紙色（`#f3efe6` / `#fffdf8` / `bg-[var(--paper)]` / `bg-[var(--surface)]`）。

### 2. 嚴格禁止的顏色地雷（❌ 絕對禁止）
- ❌ **絕對禁止使用泥濘/粉濁的淡紫色（Dusty Lavender / Muddy Indigo）**：
  - 嚴禁使用 `bg-indigo-100 text-indigo-950`、`indigo-50` 等淡紫粉灰色塊。
  - **原因**：在溫潤的米紙底色上，未經飽和調整的淡紫色會呈現如「瘀青」般的混濁骯髒感，極度破壞精品質感。
- ❌ **絕對禁止使用刺眼高亮黃色（Bright / Neon Yellow）**：
  - 嚴禁在淺色底使用純黃色、鮮黃色標籤或文字。
  - **原因**：在米白背景上對比極差且極為刺眼，使用者已多次反饋眼睛不適。
  - **替代方案**：警示或提醒一律使用沉穩溫潤的琥珀色（`amber-600` / `amber-700`）或深墨色。

### 3. 按鈕階層與質感（Button Hierarchy）
- **主要操作按鈕（Primary Buttons）**：
  - 採用具權威感、俐落乾淨的深墨色（Ink）：
    `bg-[var(--ink)] text-[var(--paper)] rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xs hover:opacity-90 active:scale-95 transition`
  - 或鮮明飽和的寶石色（如扣住退回用 `bg-blue-600 text-white`、結算用 `bg-emerald-700 text-white`）。
  - ❌ 禁止使用灰粉色、混濁低對比度色塊充當主按鈕。
- **次要／輔助按鈕（Secondary / Ghost Buttons）**：
  - 採用精緻的邊框膠囊按鈕：
    `rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] active:scale-95 transition`
- **觸控反饋（Haptic Feedback）**：
  - 所有可點擊按鈕、清單列均必須包含微縮放反饋（`active:scale-95` 或 `active:scale-90`），確保在行動裝置與 PWA 上具備實體鍵擊手感。

### 4. 圖示規範（Icon Consistency）
- **列表與卡片圖示一律使用「圓形微光徽章 + 白色 SVG」**：
  - 大小：標準列表使用 `rounded-full !h-7 !w-7`（卡片頭部可用 `h-9 w-9`）。
  - 內容：內部一律搭配簡約俐落的純白 SVG 向量圖標（stroke-2 或 solid），絕不破版。
- ❌ **嚴禁在列表使用方塊包中文字（如方塊「扣」、方塊「轉」）**：
  - 方形字塊破壞視覺韻律，呈現半成品或字體缺失的低劣視覺感。
- **語意色彩標準**：
  - **支出（Expense）**：`bg-rose-500` / `text-rose-600`
  - **收入（Income）**：`bg-emerald-600` / `text-emerald-700`
  - **扣住（Hold）**：深海寶石藍 `bg-blue-600 text-white` 搭配鎖頭 🔒 SVG，文字與金額使用 `text-blue-600 dark:text-blue-400 font-semibold`。
  - **分帳（Split）**：翡翠綠 `bg-emerald-600 text-white` 搭配雙人/群組 SVG。
  - **待核銷（Reimbursement）**：天藍 `bg-sky-600 text-white` 搭配收據 SVG。
  - **轉帳（Transfer）**：板岩灰 `bg-slate-600 text-white` 搭配雙向箭頭 ⇄ SVG。

### 5. 排版與文案細節（Typography & Copywriting）
- **避免文字贅詞與重複**：
  - 卡片已標註「暫時扣住」標籤時，標題不應顯示「扣住：電費預繳」，應過濾掉前綴只顯示「電費預繳」。
  - 數值一律標註 `tabular-nums`，確保等寬對齊不跳動。

---

## 二、業務與使用者體驗規範（UX & Logic Standards）

### 1. 預算功能規範
- **檢視預設為「年預算」**：
  - 使用者核心使用習慣是以整年為週期衡量財務。
  - 預算頁面（`/budgets`）預設應為年度預算，提供切換至月份。
- **頂部花費摘要不顯示「含請客」**：
  - 頂部大字摘要只顯示：`2026 年實際花掉（不含扣住）` 與預算進度，保持視覺清爽乾淨。
- **移除晦澀不明文案**：
  - 嚴禁出現如「恢復自動」等讓使用者困惑、不知所云的單詞。若需重設預算，請使用清晰文案如「重設為預設值」或「依歷史自動計算」。

### 2. 定期扣款與自動入帳（Recurring Automation）
- 每月/每週的定期扣款，當到達日期時必須能可靠且自動加進帳本，不可要求手動觸發，亦不可因時區或同步邏輯失效。
- 系統啟動時與每次雲端同步時，皆需執行一次 `postDueRecurring()` 檢查。

---

## 三、工程自檢與防錯規範（Zero Regression & High Craftsmanship）

每次撰寫或修改程式碼時，必須嚴格執行以下自檢流程，不可抱持「寫完就好」的僥倖心態：

1. **語法與結構檢查**：
   - 仔細檢查 JSX 的開閉標籤（`<div>`, `<button>` 等），防止多餘閉合標籤或層級錯位。
2. **顏色清理（Color Sweep）**：
   - 每次修改涉及樣式時，用 `git diff` 審查是否有殘留的 `indigo` 或刺眼 `yellow`。
3. **強制自動化測試**：
   - 提交前必須執行 `npm test`，確保 32 個測試套件 100% 全部通過。
4. **強制編譯打包檢查**：
   - 必須執行 `npm run build`，確保 TypeScript、Webpack 及 Next.js 零警告零報錯。
5. **部署確認**：
   - 每次發布執行 `npm run deploy`，確保生產環境（`https://record.benedicttiong.site`）即時更新。
