/**
 * Validates a client-supplied "return to this page after login" value.
 * Only same-origin, path-relative targets are allowed — this is the
 * standard open-redirect guard: reject absolute URLs (`https://evil.com`),
 * protocol-relative URLs (`//evil.com`, which browsers treat as absolute),
 * and any embedded scheme (`javascript:...`).
 */
export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = "/app",
): string {
  if (!value) return fallback;
  // Reject control characters (tab/newline/CR) some browsers strip while
  // parsing a URL, which can otherwise be used to smuggle a scheme past a
  // naive `startsWith("/")` check.
  if (/[\x00-\x1f]/.test(value)) return fallback;
  // Backslashes are browser-normalized to forward slashes, so "/\evil.com"
  // becomes the protocol-relative "//evil.com".
  if (value.includes("\\")) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  return value;
}
