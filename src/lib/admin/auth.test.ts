import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("admin auth — unauthorized access", () => {
  it("rejects any password when ADMIN_PASSWORD is not configured (fails closed)", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    const { verifyAdminPassword } = await import("@/lib/admin/auth");
    expect(verifyAdminPassword("anything")).toBe(false);
    expect(verifyAdminPassword("")).toBe(false);
  });

  it("rejects a configured password shorter than 12 characters (fails closed)", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "tooshort123"); // 11 chars
    const { verifyAdminPassword } = await import("@/lib/admin/auth");
    expect(verifyAdminPassword("tooshort123")).toBe(false);
  });

  it("rejects an incorrect password", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "a-real-strong-admin-password");
    const { verifyAdminPassword } = await import("@/lib/admin/auth");
    expect(verifyAdminPassword("wrong-password-entirely")).toBe(false);
  });

  it("accepts the correct password once configured", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "a-real-strong-admin-password");
    const { verifyAdminPassword } = await import("@/lib/admin/auth");
    expect(verifyAdminPassword("a-real-strong-admin-password")).toBe(true);
  });

  it("rejects a missing/undefined session token", async () => {
    const { verifyAdminSessionToken } = await import("@/lib/admin/auth");
    expect(verifyAdminSessionToken(undefined)).toBe(false);
    expect(verifyAdminSessionToken(null)).toBe(false);
    expect(verifyAdminSessionToken("")).toBe(false);
  });

  it("rejects a forged/garbage session token", async () => {
    const { verifyAdminSessionToken } = await import("@/lib/admin/auth");
    expect(verifyAdminSessionToken("not-a-real-token")).toBe(false);
  });

  it("rejects a session token issued for a different purpose (e.g. a chapter12 token)", async () => {
    const { verifyAdminSessionToken } = await import("@/lib/admin/auth");
    const { issueToken } = await import("@/lib/security/tokens");
    const chapter12Token = issueToken("some-subscriber-id", "chapter12");
    expect(verifyAdminSessionToken(chapter12Token)).toBe(false);
  });

  it("accepts a genuinely issued admin session token", async () => {
    const { issueAdminSessionToken, verifyAdminSessionToken } = await import("@/lib/admin/auth");
    const token = issueAdminSessionToken();
    expect(verifyAdminSessionToken(token)).toBe(true);
  });

  it("rejects an expired admin session token", async () => {
    vi.useFakeTimers();
    try {
      const { issueAdminSessionToken, verifyAdminSessionToken } = await import("@/lib/admin/auth");
      const token = issueAdminSessionToken();
      vi.advanceTimersByTime(1000 * 60 * 60 * 13); // 13 hours, TTL is 12
      expect(verifyAdminSessionToken(token)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
