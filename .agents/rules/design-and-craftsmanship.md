# 記帳本 (Record) 核心設計規範、美學標準與開發自檢守則

本守則為本專案最高優先級規範。所有參與本專案的 AI 代理人與工程師必須嚴格遵守，杜絕重複犯錯。

---

## 一、視覺與美學規範（乾淨簡約淺色系，日系和紙質感）

### 1. 核心配色哲學：乾淨、好看、淺色系（Light Palette Only）
- **基底底色**：溫潤米白宣紙色（`#f3efe6` / `#fffdf8` / `bg-[var(--paper)]` / `bg-[var(--surface)]`）。
- **底色禁區（❌ 絕對禁止深色按鈕底色）**：
  - ❌ **按鈕底色絕對不能是深色（NO Dark Backgrounds for Buttons/Pills/Tabs）**！
  - 嚴禁使用黑墨色塊（如 `bg-[var(--ink)] text-white`）或深藍色塊（如 `bg-blue-600 text-white`）作為常規操作按鈕或選籤。在淺色紙質背景上，深色塊會顯得極為沉重、刺眼、如突兀黑斑。
  - ❌ **絕對禁止泥濘/粉濁淡紫色（Dusty Lavender / Muddy Indigo）**，如 `bg-indigo-100 text-indigo-950` 等。
  - ❌ **絕對禁止刺眼高亮黃色（Neon / Bright Yellow）**。
  - ❌ **絕對禁止系統深色模式溢出（No OS Dark Mode Contamination）**：本 App 為固定淺色主題，Tailwind 配置 `@variant dark (&:where(.dark, .dark *));`，嚴防作業系統深色模式覆寫按鈕底色。

### 2. 按鈕與標籤的標準淺色系配色（Light-Mode Aesthetic Rules）
所有操作按鈕與選籤必須採用「**柔和淺色底 + 1px 精緻同色系邊框 + 鮮明字體色 + 點擊微縮放**」：
- **「退回」（Hold Release）**：
  `bg-[#F0F7FF] text-[#2563EB] border border-[#BFDBFE] hover:bg-[#DBEAFE] active:scale-95 shadow-2xs rounded-lg px-2.5 py-0.5 text-[11px] font-semibold`
- **「銷帳」（Reimburse）**：
  `bg-[#F0F9FF] text-[#0284C7] border border-[#BAE6FD] hover:bg-[#E0F2FE] active:scale-95 shadow-2xs rounded-lg px-2.5 py-0.5 text-[11px] font-semibold`
- **「已還／全還」（Split Settle）**：
  `bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] hover:bg-[#DCFCE7] active:scale-95 shadow-2xs rounded-lg px-2.5 py-0.5 text-[11px] font-semibold`
- **「撤銷」（Undo）**：
  `bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0] hover:text-[#0F172A] active:scale-95 shadow-2xs rounded-lg px-2.5 py-0.5 text-[11px] font-medium`
- **「請客」（Treat Tag）**：
  `bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] rounded-md px-1.5 py-0.5 text-[10px] font-medium`
- **頂部類型分頁標籤（[全部] [支出] [收入] [扣住]）**：
  - 選中全部：`bg-white text-[#1E293B] border-2 border-[#1E293B]/70 shadow-2xs font-bold`（乾淨白底浮起卡片，絕非黑色塊）
  - 選中支出：`bg-[#FEF2F2] text-[#DC2626] border-2 border-[#FCA5A5] shadow-2xs font-bold`
  - 選中收入：`bg-[#F0FDF4] text-[#16A34A] border-2 border-[#86EFAC] shadow-2xs font-bold`
  - 選中扣住：`bg-[#F0F7FF] text-[#2563EB] border-2 border-[#93C5FD] shadow-2xs font-bold`
  - 未選中：`bg-white/80 text-[#64748B] border border-[#E2E8F0] hover:text-[#1E293B]`

### 3. 圖示規範（Icon Consistency）
- 列表與卡片一律使用圓形微光徽章（`rounded-full !h-7 !w-7`）搭配白色向量 SVG。
- ❌ **嚴禁在列表使用方塊包中文字（如方塊「扣」、方塊「轉」）**。
- 扣住（Hold）：圓形寶石藍徽章搭配鎖頭 🔒 SVG，文字與金額為 `text-blue-600`。
- 轉帳（Transfer）：圓形板岩灰徽章搭配雙向箭頭 ⇄ SVG。

---

## 二、功能排版與使用者習慣規範

1. **更多頁面（/more）絕對精簡原則**：
   - ❌ **絕對禁止出現在「更多」頁面中的項目**：
     - 「帳本」（多帳本管理與切換）—— 不出現。
     - 「記帳範本」（一鍵套用常用收支模板）—— 不出現。
     - 「帳戶」（現金、銀行與信用卡帳戶管理）—— 不出現。
     - 「待辦與扣住」（待報銷款項、分帳待還與押金扣住）—— 不出現（首頁已有待處理入口）。
     - 「進階搜尋」（關鍵字、標籤與金額範圍搜尋）—— 不出現（頂部已有 🔍 搜尋圖標）。
   - **「更多」頁面僅允許包含**：
     - 常用管理：分類（`/categories`）、預算（`/budgets`）、每月固定（`/recurring`）。
     - 帳號與系統：帳號設定 / 登入設定（`/settings`）。
     - 若有定存即將到期提醒則顯示頂部卡片。
2. **預算檢視**：
   - 預算頁面（`/budgets`）預設必須為年度預算（年預算）。
   - 頂部總花費摘要只顯示 `2026 年實際花掉（不含扣住）`，不顯示「含請客」。
   - 移除無上下文不明文案（如「恢復自動」）。
3. **定期入帳可靠性**：
   - 每月固定扣款到達日期時必須自動入帳。

---

## 三、工程自檢鐵則

每次修改必須通過：
1. `npm test`（32 個測試全數通過）。
2. `npm run build`（Next.js 打包零報錯）。
3. 部署生產環境確認。
