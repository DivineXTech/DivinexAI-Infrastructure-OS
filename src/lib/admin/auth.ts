import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { env, isAdminPasswordConfigured } from "@/lib/env";
import { issueToken, verifyToken } from "@/lib/security/tokens";

/**
 * Minimal single-operator admin authentication: one shared password (set
 * via `ADMIN_PASSWORD`, never committed) gates a signed session cookie.
 *
 * This is a deliberate scope decision, not an oversight: the dashboard has
 * exactly one operator role today, so a full user table + RBAC system
 * would be unused complexity. If multiple named admins or per-admin audit
 * trails are needed later, swap this for Supabase Auth — the dashboard
 * routes already gate on `verifyAdminSessionToken()` alone, so only this
 * file and the login route would need to change.
 */

export const ADMIN_SESSION_COOKIE = "bb_admin_session";

/** Fixed admin "subject" id — there is only one operator account. */
const ADMIN_SUBJECT = "admin";

function constantTimeEquals(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Verifies a submitted password against `ADMIN_PASSWORD`. Fails closed
 * (always returns false) if the password isn't configured or is shorter
 * than 12 characters — there is no "dev fallback" admin password, since
 * that would mean every deployment of this codebase ships the same
 * default dashboard credential.
 */
export function verifyAdminPassword(submitted: string): boolean {
  if (!isAdminPasswordConfigured() || !submitted) return false;
  return constantTimeEquals(submitted, env.adminPassword!);
}

export function issueAdminSessionToken(): string {
  return issueToken(ADMIN_SUBJECT, "admin_session");
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const payload = verifyToken(token, "admin_session");
  return payload !== null && payload.sub === ADMIN_SUBJECT;
}
