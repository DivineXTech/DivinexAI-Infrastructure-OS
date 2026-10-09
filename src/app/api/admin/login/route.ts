import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { issueAdminSessionToken, verifyAdminPassword, ADMIN_SESSION_COOKIE } from "@/lib/admin/auth";
import { isAdminPasswordConfigured } from "@/lib/env";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp, hashIp } from "@/lib/security/request-ip";
import { getAuditLogStore } from "@/lib/store/audit-log-store";

export const dynamic = "force-dynamic";

const loginSchema = z.object({ password: z.string().min(1) });
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // matches admin_session token TTL

export async function POST(request: NextRequest) {
  const ipKey = hashIp(getClientIp(request));
  // Deliberately tight: this endpoint guards the whole dashboard.
  const rateLimit = checkRateLimit(`admin-login:${ipKey}`, 5, 15 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 },
    );
  }

  if (!isAdminPasswordConfigured()) {
    // Logged server-side only — the client response stays generic so this
    // state can't be distinguished from "wrong password" by an attacker.
    console.error("[admin/login] ADMIN_PASSWORD is not configured.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  if (!verifyAdminPassword(parsed.data.password)) {
    await getAuditLogStore().record({
      actor: "unknown",
      action: "admin_login_failed",
      metadata: { ip: ipKey },
    });
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = issueAdminSessionToken();
  await getAuditLogStore().record({ actor: "admin", action: "admin_login_succeeded" });

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    // `secure` only over HTTPS — hardcoding `true` would silently break
    // the cookie (and thus the whole login) on plain-HTTP local dev.
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
