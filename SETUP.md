# 完整設定指南（Supabase + Vercel + 本機）

本文件逐步說明：**要點哪裡、要複製哪個值、要貼到哪裡**。照著做即可完成雲端同步與部署。

---

## 目錄

1. [Supabase 專案與 API 金鑰](#1-supabase-專案與-api-金鑰)
2. [執行 SQL 遷移（資料表）](#2-執行-sql-遷移資料表)
3. [啟用 Email 登入與 Redirect URL](#3-啟用-email-登入與-redirect-url)
4. [本機 `.env.local`](#4-本機-envlocal)
5. [Vercel 部署](#5-vercel-部署)
6. [把 Vercel 網域加回 Supabase](#6-把-vercel-網域加回-supabase)
7. [之後如何重新部署](#7-之後如何重新部署)
8. [可選：不設 Supabase（僅離線）](#8-可選不設-supabase僅離線)

---

## 1. Supabase 專案與 API 金鑰

### 1.1 建立專案

1. 開啟瀏覽器，前往：**https://supabase.com**
2. 登入（可用 GitHub / 信箱）。
3. 進入 Dashboard 後，點 **New project**（新增專案）。
4. 填寫：
   - **Name**：專案名稱（例如 `ledger`）
   - **Database Password**：請自己設定並**妥善保存**（本 App 平常不需要這個密碼）
   - **Region**：選離你較近的區域
5. 點 **Create new project**，等待專案建立完成（約 1–2 分鐘）。

### 1.2 取得 Project URL（對應 `NEXT_PUBLIC_SUPABASE_URL`）

1. 在左側選單點 **Project Settings**（齒輪圖示，通常在左下角）。
2. 在設定頁左側點 **API**。
3. 在 **Project URL** 區塊，複製整串網址，形如：

   ```text
   https://xxxxxxxx.supabase.co
   ```

4. 這個值稍後會填入環境變數：`NEXT_PUBLIC_SUPABASE_URL`。

### 1.3 取得 anon public key（對應 `NEXT_PUBLIC_SUPABASE_ANON_KEY`）

仍在同一頁：**Project Settings → API**。

1. 找到 **Project API keys** 區塊。
2. 複製標示為 **`anon` `public`** 的那一把 key（長字串，通常以 `eyJ...` 開頭）。
3. 這個值稍後會填入：`NEXT_PUBLIC_SUPABASE_ANON_KEY`。

> **重要：** 請使用 **anon / public** key。  
> **不要**複製 **`service_role`** key。`service_role` 擁有完整權限，絕不可放進前端或 `NEXT_PUBLIC_*` 環境變數。

---

## 2. 執行 SQL 遷移（資料表）

必須依**順序**執行 SQL 遷移。每一份都是：打開檔案 → 全選複製 → 貼到 SQL Editor → Run。

### 2.1 打開 SQL Editor

1. 在 Supabase 專案左側選單點 **SQL Editor**。
2. 點 **New query**（新增查詢）。

### 2.2 依序執行這些檔案

在本專案目錄中，檔案位置為：

| 順序 | 檔案路徑 |
|------|----------|
| 1 | `supabase/migrations/001_init.sql` |
| 2 | `supabase/migrations/002_category_color_and_budgets.sql` |
| 3 | `supabase/migrations/003_books.sql` |
| 4 | `supabase/migrations/004_templates_and_balances.sql` |
| 5 | `supabase/migrations/005_holdings.sql` |

**每個檔案的操作步驟：**

1. 用編輯器打開該 `.sql` 檔。
2. `Ctrl+A` 全選 → `Ctrl+C` 複製。
3. 回到 Supabase **SQL Editor**，貼上內容。
4. 點右下角（或上方）**Run**（執行）。
5. 確認右下角顯示成功（Success / 無錯誤）。
6. 再開一個 **New query**，對下一份檔案重複同樣步驟。

執行完成後應有：`accounts`、`categories`、`transactions`、`budgets`、`books`、`templates`、`holdings`，以及各表的 RLS 政策；`003` 會替子表加上 `book_id`；`005` 是存款／資產（定存、基金、電子錢包）。如果專案早已跑過 001–003，只要補跑尚未執行的 004、005。

---

## 3. 啟用 Email 登入與 Redirect URL

### 3.1 啟用 Email Provider

1. 左側選單點 **Authentication**。
2. 點上方或左側的 **Providers**。
3. 找到 **Email**，確認為 **Enabled**（啟用）。
4. 若使用「魔法連結 / Magic Link」登入，通常維持預設即可；若有關閉 Email，請打開並 **Save**。

### 3.2 設定 Site URL 與 Redirect URLs

1. 仍在 **Authentication**，點 **URL Configuration**（有的介面在 Authentication → Settings）。
2. **Site URL**：
   - 本機開發可先填：`http://localhost:3000`
   - 部署到 Vercel 後，建議改成你的正式網域，例如：`https://your-app.vercel.app`
3. **Redirect URLs**（允許的回調網址）— **逐行新增**以下（把網域換成你的）：

   ```text
   http://localhost:3000/auth/callback
   http://localhost:3000/**
   https://YOUR_VERCEL_DOMAIN.vercel.app/auth/callback
   https://YOUR_VERCEL_DOMAIN.vercel.app/**
   ```

4. 點 **Save** 儲存。

> 若暫時還沒有 Vercel 網域，可先只加 localhost；部署後再回來補上（見第 6 節）。

---

## 4. 本機 `.env.local`

### 4.1 建立檔案

在專案根目錄（與 `package.json` 同層）建立檔案：`.env.local`。

也可從範例複製：

```bash
cp .env.example .env.local
```

（Windows PowerShell 可用：`Copy-Item .env.example .env.local`）

### 4.2 檔案內容範例

把下方兩行改成你在第 1 節複製的真實值：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx
```

- `NEXT_PUBLIC_SUPABASE_URL` = Project Settings → API → **Project URL**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Project Settings → API → **anon public** key

### 4.3 啟動本機

```bash
npm install
npm run dev
```

瀏覽器開啟：http://localhost:3000

修改 `.env.local` 後需要**重啟** `npm run dev` 才會生效。

---

## 5. Vercel 部署

前提：程式碼已推到 **GitHub**（或 GitLab / Bitbucket，Vercel 支援的來源）。

### 5.1 匯入專案

1. 開啟：**https://vercel.com** 並登入。
2. 點 **Add New…** → **Project**。
3. 從 Git 列表選你的 repo，點 **Import**。

### 5.2 Framework 設定

1. **Framework Preset** 選 **Next.js**（通常會自動偵測）。
2. Root Directory 維持預設即可（除非 monorepo）。
3. Build / Output 使用預設即可。

### 5.3 環境變數（一定要加）

在 Import 畫面的 **Environment Variables**（或之後 Project → Settings → Environment Variables）：

| Name | Value | 環境 |
|------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 與本機相同的 Project URL | Production **與** Preview 都勾選 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 與本機相同的 anon public key | Production **與** Preview 都勾選 |

請勾選 **Production** 與 **Preview**，避免 Preview 部署無法登入／同步。

### 5.4 部署並複製網域

1. 點 **Deploy**。
2. 等待建置完成。
3. 在專案頁面複製網域，例如：`https://your-app.vercel.app`  
   （也可在 Project → Settings → Domains 查看。）

---

## 6. 把 Vercel 網域加回 Supabase

部署完成後，必須讓 Supabase 接受從 Vercel 回來的登入回調：

1. 回到 Supabase → **Authentication** → **URL Configuration**。
2. **Site URL** 可改為：`https://YOUR_VERCEL_DOMAIN.vercel.app`
3. 在 **Redirect URLs** 新增（若尚未加入）：

   ```text
   https://YOUR_VERCEL_DOMAIN.vercel.app/auth/callback
   https://YOUR_VERCEL_DOMAIN.vercel.app/**
   ```

4. **Save**。

之後在正式網域用 Email 登入，魔法連結才會正確導回 App。

---

## 7. 之後如何重新部署

一般流程：

1. 在本機改完程式，`git add` / `git commit` / `git push` 到已連線的 GitHub 分支（通常是 `main`）。
2. Vercel 會**自動**偵測 push 並開始新一輪 Deploy。
3. 到 Vercel Dashboard → 該專案 → **Deployments** 查看狀態（Building → Ready）。
4. Ready 後開啟正式網域即可看到新版本。

若只改了環境變數、沒改程式：

1. Vercel → Project → **Settings** → **Environment Variables** 更新後儲存。
2. 再到 **Deployments**，對最新一筆點 **⋯** → **Redeploy**（或觸發一次新的 Deploy），讓新變數生效。

---

## 8. 可選：不設 Supabase（僅離線）

若**不建立** `.env.local`，或留下空白／不填這兩個變數：

- App 仍可正常使用：記帳、帳戶、分類、帳簿切換等資料存在瀏覽器 **IndexedDB**。
- 不會連上雲端；登入／跨裝置同步不可用。
- 介面可能顯示「尚未設定 Supabase」或類似本機狀態，屬預期行為。

之後若要開啟同步，再依本文件第 1–4 節補上金鑰與 migration，登入後即可開始 pull / push。

---

## 快速檢查清單

- [ ] Supabase 專案已建立  
- [ ] 已複製 **Project URL** 與 **anon public**（不是 service_role）  
- [ ] SQL Editor 已依序執行 `001` → `002` → `003`  
- [ ] Authentication → Providers → Email 已啟用  
- [ ] Redirect URLs 含 localhost 與 Vercel `/auth/callback`  
- [ ] 本機 `.env.local` 已填兩行 `NEXT_PUBLIC_*`  
- [ ] Vercel 已設定相同兩行環境變數（Production + Preview）  
- [ ] 部署後已把 Vercel 網域加回 Supabase Redirect URLs  
