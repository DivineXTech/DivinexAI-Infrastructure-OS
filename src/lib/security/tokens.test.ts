import { describe, expect, it, vi } from "vitest";
import { issueToken, verifyToken } from "@/lib/security/tokens";

describe("security/tokens", () => {
  it("issues a token that verifies for the correct purpose", () => {
    const token = issueToken("subscriber-123", "chapter12");
    const payload = verifyToken(token, "chapter12");
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("subscriber-123");
    expect(payload?.purpose).toBe("chapter12");
  });

  it("rejects a token verified against the wrong purpose", () => {
    const token = issueToken("subscriber-123", "chapter12");
    expect(verifyToken(token, "status")).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = issueToken("subscriber-123", "chapter12");
    const [payload] = token.split(".");
    const tampered = `${payload}.not-a-real-signature`;
    expect(verifyToken(tampered, "chapter12")).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyToken("not-a-token", "chapter12")).toBeNull();
    expect(verifyToken("", "chapter12")).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    try {
      const token = issueToken("subscriber-123", "status");
      vi.advanceTimersByTime(1000 * 60 * 60 * 24 * 31); // 31 days, status TTL is 30
      expect(verifyToken(token, "status")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
