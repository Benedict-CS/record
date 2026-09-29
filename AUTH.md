# 登入／註冊／同步流程說明

本文件記錄 **Record（記帳本）** 目前的帳號與同步行為。  
認證走 **帳號名稱 + 密碼**（例如 `benedict`）。底層仍是 Supabase Email provider，名稱會存成 `名稱@users.record`，畫面上不出現這組信箱。與 Google 無關。

正式網址：https://record.benedicttiong.site  
登入頁：https://record.benedicttiong.site/login

---

## 現況總覽

| 功能 | 有沒有 | 說明 |
|------|--------|------|
| 不登入也能記帳 | ✅ | 資料存在該裝置瀏覽器 IndexedDB |
| 登入（Sign in）帳號 + 密碼 | ✅ | 登入頁「登入」分頁。舊 Email 在改名完成前仍可登 |
| 註冊（Sign up）帳號 + 密碼 | ✅ | 登入頁「註冊」分頁。帳號是名稱，不是 Email |
| 已登入時設定／更新密碼 | ✅ | 登入頁下方表單（給先前用 magic link 的人補密碼） |
| 登出 | ✅ | 登出後仍可離線記帳，不再雲端同步 |
| 多裝置同步 | ✅ | 同一帳號登入後，有網路時自動 sync |
| 忘記密碼／重設密碼（寄信） | ❌ **尚未做** | 需要寄信；Supabase 內建信箱有嚴格 rate limit，正式做建議先接自訂 SMTP |
| Google／其他社群登入 | ❌ | 刻意不做 |
| Username（非 Email）登入 | ✅ | 例如 `benedict` + 密碼。`009` 把 `ben111611@gmail.com` 改成這個名稱 |
| 帳密寫在 `.env` | ❌ | `.env` 只放 Supabase URL／anon key，**不要**放使用者密碼 |

---

## 資料存在哪裡

1. **本機（每台裝置各自一份）**  
   - IndexedDB（Dexie）  
   - 不登入也能完整記帳  

2. **雲端（登入後）**  
   - Supabase Postgres  
   - 寫入仍先寫本機，再標記 `pending`，上線後同步  

3. **環境變數（不是使用者帳密）**  
   - `NEXT_PUBLIC_SUPABASE_URL`  
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   - 本機：`.env.local`  
   - 線上：Vercel Environment Variables  

---

## 其他人要用怎麼辦？

可以。流程是 **自己在 App 註冊一組帳號名稱 + 密碼**。

前提（Supabase Dashboard）：

1. **Authentication → Sign In / Providers**  
   - **Email** = Enabled  
2. **Authentication → Sign In / Providers**（或一般設定）  
   - **Allow new users to sign up** = 開啟  
3. **Confirm email 必須關閉。** 帳號沒有信箱可收驗證信。

對方操作：

1. 打開 https://record.benedicttiong.site/login  
2. 點 **註冊**  
3. 輸入自己的帳號名稱 + 密碼（至少 6 碼）→ 送出，例如 `alex`  
4. 之後用同一組 **登入**  

每位使用者的雲端資料受 RLS 隔離（只能看到自己的列）；**不會**自動看到你本機／你帳號的帳本內容。

> 注意：這是「每人自己的帳本雲端」，不是「共用同一個家庭帳本帳號」。若要多人共用同一份帳，需另做共用／邀請設計（目前沒有）。

---

## 流程圖：註冊（Sign up）

```text
使用者開啟 /login
    → 點「註冊」
    → 輸入帳號名稱 + 密碼（例如 benedict）
    → App 轉成 benedict@users.record，呼叫 supabase.auth.signUp()
         ├─ Confirm email 關閉：立刻有 session → 已登入 → 開始可同步
         └─ Confirm email 開啟：沒有信箱可點，註冊完無法登入。請關掉再註冊
```

## 流程圖：登入（Sign in）

```text
使用者開啟 /login
    → 點「登入」
    → 輸入帳號名稱 + 密碼（改名完成前，舊 Email 也還能登）
    → App 呼叫 supabase.auth.signInWithPassword()
         ├─ 成功：寫入 session（cookie）→ 觸發 runSync()
         └─ 失敗：顯示錯誤（密碼錯、未註冊等）
```

## 流程圖：已登入者補設密碼

（適用：以前用 magic link 登入、帳號已存在但還沒密碼）

```text
已登入狀態打開 /login
    → 「設定／更新密碼」輸入新密碼
    → App 呼叫 supabase.auth.updateUser({ password })
    → 之後可用帳號名稱 + 密碼在其他裝置登入
```

## 流程圖：日常記帳與同步

同一台瀏覽器可以放多個帳號的資料，但畫面上一次只看一個身份。

| 現在的身份 | 看得到 | 會上傳 |
|------------|--------|--------|
| 未登入 | 這台自己的帳（`user_id` 空） | 不會 |
| 已登入帳號 A | 只有 A 的紀錄 | 只有 A 的待同步列 |
| 登出後改登帳號 B | 只有 B 的紀錄（沒有就拉雲端，或建立 B 自己的空帳本） | 只有 B 的列 |

未登入時記的帳留在這台，**不會**在下次登入時自動歸給那個帳號。帳號 A 的紀錄也不會在登入 B 時被推上 B 的雲端。

```text
任何操作（記一筆、改帳戶…）
    → 先寫 IndexedDB（本機），並標上目前身份
    → sync_status = pending
    → 若已登入且有網路
         → 只 pull 這個帳號的遠端變更
         → 只 push 這個帳號的 pending 列
登出
    → 畫面切回這台自己的帳（可繼續離線記）
    → 上一個帳號的資料留在本機，但先藏起來，等同一個帳號再登入才看得到
```

## 流程圖：忘記密碼（尚未實作）

```text
理想流程（未來）：
  /login →「忘記密碼」→ 輸入 Email
       → supabase.auth.resetPasswordForEmail()
       → 使用者點信裡連結 → /auth/callback（或重設頁）
       → 輸入新密碼 → updateUser({ password })

目前：App 沒有此按鈕與頁面。
限制：寄信會吃 Supabase 寄信額度；未接自訂 SMTP 前不建議當正式方案。
暫代方案：
  - 若還登得進去：用「設定／更新密碼」
  - 若完全進不去：到 Supabase → Authentication → Users 由管理員處理，或之後接 SMTP 再做忘記密碼
```

---

## UI 位置

| 畫面 | 內容 |
|------|------|
| `/login` | 未登入：帳號名稱 + 密碼的登入／註冊；已登入會直接進帳本 |
| `/more` →「登入同步」 | 捷徑進 `/login`；已登入會顯示「已登入」 |
| `/auth/callback` | OAuth／信箱連結回調（舊 magic link、未來重設密碼可能用到） |

---

## Supabase 建議設定（密碼方案）

| 設定 | 建議 |
|------|------|
| Email provider | Enabled |
| Allow new users to sign up | 開（若允許別人註冊）／關（僅你自己） |
| Confirm email | **必須關**。帳號名稱沒有信箱可收驗證信 |
| Google 等第三方 | 關 |
| Site URL | `https://record.benedicttiong.site` |
| Redirect URLs | 含 `https://record.benedicttiong.site/**`、localhost、vercel 網域 |

---

## 部署相關

- 程式：GitHub `Benedict-CS/record`；上線以 **Vercel CLI** 為準（`npm run deploy`）
- Hobby 私有庫時 Git 自動部署可能被擋，不必依賴 push 自動上線
- 自訂網域：`record.benedicttiong.site`（Cloudflare DNS → Vercel）
- 使用者密碼 **不會**、也 **不該** 出現在 repo 或 `.env`

---

## 之後若要補「忘記密碼」

建議順序：

1. 接自訂 SMTP（例如 Resend）解決寄信額度  
2. App 加「忘記密碼」→ 寄重設信 → 重設頁設新密碼  
3. 更新本文件的「忘記密碼」一節為 ✅  

在未做 SMTP 前，請勿依賴大量寄信登入／重設。
