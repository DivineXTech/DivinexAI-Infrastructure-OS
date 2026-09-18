import { describe, expect, it } from "vitest";

import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

describe("getSafeRedirectPath", () => {
  it("allows a plain relative path", () => {
    expect(getSafeRedirectPath("/app/orders")).toBe("/app/orders");
  });

  it("falls back when empty or missing", () => {
    expect(getSafeRedirectPath(null)).toBe("/app");
    expect(getSafeRedirectPath(undefined)).toBe("/app");
    expect(getSafeRedirectPath("")).toBe("/app");
  });

  it("rejects absolute URLs", () => {
    expect(getSafeRedirectPath("https://evil.com")).toBe("/app");
    expect(getSafeRedirectPath("http://evil.com/phish")).toBe("/app");
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeRedirectPath("//evil.com")).toBe("/app");
  });

  it("rejects backslash tricks that browsers normalize to //", () => {
    expect(getSafeRedirectPath("/\\evil.com")).toBe("/app");
  });

  it("rejects embedded schemes", () => {
    expect(getSafeRedirectPath("/redirect?to=javascript://alert(1)")).toBe("/app");
  });

  it("rejects values without a leading slash", () => {
    expect(getSafeRedirectPath("evil.com")).toBe("/app");
  });

  it("rejects embedded control characters", () => {
    expect(getSafeRedirectPath("/app\n.evil.com")).toBe("/app");
  });

  it("respects a custom fallback", () => {
    expect(getSafeRedirectPath("https://evil.com", "/login")).toBe("/login");
  });
});
