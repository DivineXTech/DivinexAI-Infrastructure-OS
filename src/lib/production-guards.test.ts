import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("subscriber-store production guard", () => {
  it("throws instead of falling back to the in-memory store in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const { getSubscriberStore } = await import("@/lib/store/subscriber-store");
    expect(() => getSubscriberStore()).toThrow(/Supabase is not configured/);
  });
});

describe("email production guard", () => {
  it("throws instead of logging a simulated send in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");

    const { sendEmail } = await import("@/lib/email/resend");
    await expect(
      sendEmail({ to: "a@example.com", subject: "s", html: "<p>h</p>", text: "t" }),
    ).rejects.toThrow(/RESEND_API_KEY is not configured/);
  });
});
