import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env.isRunningInProduction", () => {
  it("is false by default (no VERCEL_ENV)", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    const { isRunningInProduction } = await import("@/lib/env");
    expect(isRunningInProduction()).toBe(false);
  });

  it("is false for Vercel preview deployments", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const { isRunningInProduction } = await import("@/lib/env");
    expect(isRunningInProduction()).toBe(false);
  });

  it("is false for NODE_ENV=production alone (next build / next start)", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    const { isRunningInProduction } = await import("@/lib/env");
    expect(isRunningInProduction()).toBe(false);
  });

  it("is true only for VERCEL_ENV=production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { isRunningInProduction } = await import("@/lib/env");
    expect(isRunningInProduction()).toBe(true);
  });

  it("honors an explicit APP_ENV=production on a non-Vercel host", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("APP_ENV", "production");
    const { isRunningInProduction } = await import("@/lib/env");
    expect(isRunningInProduction()).toBe(true);
  });

  it("lets APP_ENV override a conflicting VERCEL_ENV", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("APP_ENV", "development");
    const { isRunningInProduction } = await import("@/lib/env");
    expect(isRunningInProduction()).toBe(false);
  });

  it("falls back to VERCEL_ENV / development for an invalid APP_ENV value", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("APP_ENV", "prod"); // common typo, not a recognized value
    const { isRunningInProduction } = await import("@/lib/env");
    expect(isRunningInProduction()).toBe(true); // falls back to VERCEL_ENV
  });
});

describe("env.assertTokenSecretConfigured", () => {
  it("throws in production when APP_TOKEN_SECRET is unset", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("APP_TOKEN_SECRET", "");
    const { assertTokenSecretConfigured } = await import("@/lib/env");
    expect(() => assertTokenSecretConfigured()).toThrow(/APP_TOKEN_SECRET/);
  });

  it("does not throw in production once APP_TOKEN_SECRET is set", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("APP_TOKEN_SECRET", "a-real-secret");
    const { assertTokenSecretConfigured } = await import("@/lib/env");
    expect(() => assertTokenSecretConfigured()).not.toThrow();
  });

  it("only warns (does not throw) outside production", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("APP_TOKEN_SECRET", "");
    const { assertTokenSecretConfigured } = await import("@/lib/env");
    expect(() => assertTokenSecretConfigured()).not.toThrow();
  });
});
