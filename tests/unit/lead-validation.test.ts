import { describe, expect, it } from "vitest";

import { leadSchema } from "@/lib/validation/lead";

describe("leadSchema", () => {
  const base = {
    leadType: "general_contact" as const,
    fullName: "Jane Doe",
    email: "jane@example.com",
    consentGiven: true,
  };

  it("accepts a minimal valid submission", () => {
    expect(leadSchema.safeParse(base).success).toBe(true);
  });

  it("requires consent to be explicitly true", () => {
    const result = leadSchema.safeParse({ ...base, consentGiven: false });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = leadSchema.safeParse({ ...base, fullName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = leadSchema.safeParse({ ...base, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown lead type", () => {
    const result = leadSchema.safeParse({ ...base, leadType: "not_a_real_type" });
    expect(result.success).toBe(false);
  });

  it("allows the honeypot field to be present without affecting validity", () => {
    const result = leadSchema.safeParse({ ...base, companyWebsite: "" });
    expect(result.success).toBe(true);
  });
});
