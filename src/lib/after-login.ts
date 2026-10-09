/** Only this path may be resumed after a login started from the delete page. */
const AFTER_LOGIN_KEY = "ledger_after_login";
const ALLOWED_AFTER_LOGIN = "/delete-account";

export function allowedAfterLogin(path: string | null | undefined): string {
  return path === ALLOWED_AFTER_LOGIN ? ALLOWED_AFTER_LOGIN : "/";
}

export function rememberAfterLogin(path: string) {
  if (typeof sessionStorage === "undefined") return;
  const next = allowedAfterLogin(path);
  if (next === "/") return;
  sessionStorage.setItem(AFTER_LOGIN_KEY, next);
}

/** Read without clearing. Login can run twice in development and must still agree. */
export function peekAfterLogin(): string {
  if (typeof sessionStorage === "undefined") return "/";
  return allowedAfterLogin(sessionStorage.getItem(AFTER_LOGIN_KEY));
}

export function clearAfterLogin() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(AFTER_LOGIN_KEY);
}
