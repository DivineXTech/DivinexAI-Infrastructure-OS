import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, issueAdminSessionToken } from "@/lib/admin/auth";
import { isAdminRequestAuthorized } from "@/lib/admin/guard";

function requestWithCookie(value?: string): NextRequest {
  const request = new NextRequest("http://localhost/api/admin/rewards/some-id");
  if (value !== undefined) {
    request.cookies.set(ADMIN_SESSION_COOKIE, value);
  }
  return request;
}

describe("isAdminRequestAuthorized — unauthorized access to /api/admin/* routes", () => {
  it("rejects a request with no session cookie at all", () => {
    expect(isAdminRequestAuthorized(requestWithCookie())).toBe(false);
  });

  it("rejects a request with an empty session cookie", () => {
    expect(isAdminRequestAuthorized(requestWithCookie(""))).toBe(false);
  });

  it("rejects a request with a garbage/forged session cookie", () => {
    expect(isAdminRequestAuthorized(requestWithCookie("forged.garbage"))).toBe(false);
  });

  it("rejects a session cookie minted for a different purpose (token confusion)", async () => {
    const { issueToken } = await import("@/lib/security/tokens");
    const wrongPurposeToken = issueToken("admin", "status");
    expect(isAdminRequestAuthorized(requestWithCookie(wrongPurposeToken))).toBe(false);
  });

  it("accepts a genuine admin session cookie", () => {
    const token = issueAdminSessionToken();
    expect(isAdminRequestAuthorized(requestWithCookie(token))).toBe(true);
  });
});
