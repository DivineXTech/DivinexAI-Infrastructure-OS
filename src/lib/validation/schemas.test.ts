import { describe, expect, it } from "vitest";
import { waitlistFormSchema } from "@/lib/validation/schemas";

const validPayload = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "",
  country: "United Kingdom",
  marketingConsent: true,
  termsAccepted: true as const,
  socialFollowConfirmed: true,
  socialLikeConfirmed: true,
  socialShareConfirmed: true,
  referralCode: "",
  source: "landing",
  companyWebsite: "",
};

describe("waitlistFormSchema", () => {
  it("accepts a valid submission", () => {
    const result = waitlistFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("requires termsAccepted to be exactly true", () => {
    const result = waitlistFormSchema.safeParse({ ...validPayload, termsAccepted: false });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = waitlistFormSchema.safeParse({ ...validPayload, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a filled honeypot field", () => {
    const result = waitlistFormSchema.safeParse({
      ...validPayload,
      companyWebsite: "https://spambot.example",
    });
    expect(result.success).toBe(false);
  });

  it("requires a first name", () => {
    const result = waitlistFormSchema.safeParse({ ...validPayload, firstName: "" });
    expect(result.success).toBe(false);
  });

  it("lowercases and trims the email", () => {
    const result = waitlistFormSchema.safeParse({ ...validPayload, email: "  ADA@EXAMPLE.COM  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
    }
  });
});
