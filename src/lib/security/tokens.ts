import { createHmac, timingSafeEqual } from "node:crypto";
import { env, warnIfDevTokenSecret } from "@/lib/env";

/**
 * Signed, expiring, stateless tokens used for "magic link" style access:
 * Chapter 12 gating, the subscriber status portal, and one-click unsubscribe.
 *
 * There is no session/auth system for subscribers by design — a waitlist
 * doesn't need passwords. Instead each email contains a link carrying a
 * signed token that proves possession of that link without exposing the
 * database.
 */

export type TokenPurpose = "chapter12" | "status" | "unsubscribe";

export interface TokenPayload {
  sub: string; // subscriber id
  purpose: TokenPurpose;
  iat: number; // issued-at, epoch seconds
  exp: number; // expiry, epoch seconds
}

const PURPOSE_TTL_SECONDS: Record<TokenPurpose, number> = {
  chapter12: 60 * 60 * 24 * 90, // 90 days
  status: 60 * 60 * 24 * 30, // 30 days
  unsubscribe: 60 * 60 * 24 * 365, // 1 year
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  warnIfDevTokenSecret();
  return createHmac("sha256", env.tokenSecret).update(data).digest("base64url");
}

export function issueToken(subscriberId: string, purpose: TokenPurpose): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: subscriberId,
    purpose,
    iat: now,
    exp: now + PURPOSE_TTL_SECONDS[purpose],
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyToken(
  token: string,
  expectedPurpose: TokenPurpose,
): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  const expectedSignature = sign(encodedPayload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.purpose !== expectedPurpose) return null;
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}
