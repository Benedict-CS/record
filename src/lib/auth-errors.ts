/** Map Supabase / auth English errors to short Traditional Chinese. */
export function formatAuthError(message: string | undefined | null): string {
  const raw = (message ?? "").trim();
  if (!raw) return "登入失敗，請再試一次";
  const lower = raw.toLowerCase();

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid_credentials")
  ) {
    return "Email 或密碼不對";
  }
  if (lower.includes("email not confirmed")) {
    return "請先到信箱點驗證連結";
  }
  if (lower.includes("user already registered")) {
    return "這個 Email 已經註冊過，請改用登入";
  }
  if (
    lower.includes("auth session missing") ||
    lower.includes("session missing")
  ) {
    return "尚未登入，請先登入再開啟此功能";
  }
  if (lower.includes("password should be at least")) {
    return "密碼至少要 6 碼";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "嘗試太多次，請稍後再試";
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "網路不通，請檢查連線後再試";
  }
  return raw;
}
