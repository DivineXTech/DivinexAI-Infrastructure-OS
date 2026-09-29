import { describe, expect, it } from "vitest";
import {
  generateReferralCode,
  isValidReferralCodeFormat,
  normalizeReferralCode,
} from "@/lib/referral";

describe("referral", () => {
  it("generates 8-character codes from the unambiguous alphabet", () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });

  it("generates unique-looking codes across many calls", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateReferralCode()));
    expect(codes.size).toBe(200);
  });

  it("validates format strictly", () => {
    expect(isValidReferralCodeFormat(generateReferralCode())).toBe(true);
    expect(isValidReferralCodeFormat("short")).toBe(false);
    expect(isValidReferralCodeFormat("TOOLONGCODE")).toBe(false);
    expect(isValidReferralCodeFormat("O0O0I1I1")).toBe(false); // excluded ambiguous chars
  });

  it("normalizes codes to uppercase and trims whitespace", () => {
    expect(normalizeReferralCode("  abcd1234  ")).toBe("ABCD1234");
  });
});
