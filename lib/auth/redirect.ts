// Pure helpers for post-login redirects.

export const LOGIN_PATH = "/connexion";
export const INACTIVE_PATH = "/compte-inactif";
export const FORBIDDEN_PATH = "/acces-refuse";

/** Paths reachable without a session. */
export const PUBLIC_PATHS: readonly string[] = [LOGIN_PATH];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Only allow same-origin relative paths as redirect targets to prevent open
 * redirects (e.g. "//evil.com", "https://evil.com", "/\\evil.com").
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  if (value === LOGIN_PATH || value.startsWith(`${LOGIN_PATH}?`)) return fallback;
  return value;
}
