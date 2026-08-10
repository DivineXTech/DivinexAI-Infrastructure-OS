import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getEnv,
  hasAnthropicCredentials,
  hasElevenLabsCredentials,
  hasMusicProviderCredentials,
  hasSupabaseCredentials,
  hasVideoProviderCredentials,
  resetEnvCacheForTests,
} from "@/src/env";

const ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "VIDEO_PROVIDER",
  "VIDEO_PROVIDER_BASE_URL",
  "VIDEO_PROVIDER_API_KEY",
  "MUSIC_PROVIDER",
  "MUSIC_PROVIDER_BASE_URL",
  "MUSIC_PROVIDER_API_KEY",
] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  resetEnvCacheForTests();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  resetEnvCacheForTests();
});

describe("getEnv", () => {
  it("parses successfully with zero credentials configured", () => {
    expect(() => getEnv()).not.toThrow();
    const env = getEnv();
    expect(env.VIDEO_PROVIDER).toBe("mock");
    expect(env.MUSIC_PROVIDER).toBe("mock");
    expect(env.PUBLISHING_PROVIDER).toBe("mock");
  });

  it("treats empty strings the same as unset", () => {
    process.env.ANTHROPIC_API_KEY = "";
    resetEnvCacheForTests();
    expect(hasAnthropicCredentials()).toBe(false);
  });

  it("rejects an invalid VIDEO_PROVIDER value", () => {
    process.env.VIDEO_PROVIDER = "not-a-real-provider";
    resetEnvCacheForTests();
    expect(() => getEnv()).toThrow(/Invalid environment configuration/);
  });
});

describe("credential detection", () => {
  it("hasAnthropicCredentials is false when unset, true when set", () => {
    expect(hasAnthropicCredentials()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    resetEnvCacheForTests();
    expect(hasAnthropicCredentials()).toBe(true);
  });

  it("hasSupabaseCredentials requires all three vars together", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    resetEnvCacheForTests();
    expect(hasSupabaseCredentials()).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    resetEnvCacheForTests();
    expect(hasSupabaseCredentials()).toBe(true);
  });

  it("hasElevenLabsCredentials requires both api key and voice id", () => {
    process.env.ELEVENLABS_API_KEY = "el-key";
    resetEnvCacheForTests();
    expect(hasElevenLabsCredentials()).toBe(false);

    process.env.ELEVENLABS_VOICE_ID = "voice-1";
    resetEnvCacheForTests();
    expect(hasElevenLabsCredentials()).toBe(true);
  });

  it("hasVideoProviderCredentials requires VIDEO_PROVIDER=http plus both vars", () => {
    process.env.VIDEO_PROVIDER_BASE_URL = "https://vendor.example.com";
    process.env.VIDEO_PROVIDER_API_KEY = "vendor-key";
    resetEnvCacheForTests();
    // Still mock (default) even with creds set, until VIDEO_PROVIDER=http.
    expect(hasVideoProviderCredentials()).toBe(false);

    process.env.VIDEO_PROVIDER = "http";
    resetEnvCacheForTests();
    expect(hasVideoProviderCredentials()).toBe(true);
  });

  it("hasMusicProviderCredentials mirrors the video provider rule", () => {
    process.env.MUSIC_PROVIDER = "http";
    resetEnvCacheForTests();
    expect(hasMusicProviderCredentials()).toBe(false);

    process.env.MUSIC_PROVIDER_BASE_URL = "https://music-vendor.example.com";
    process.env.MUSIC_PROVIDER_API_KEY = "vendor-key";
    resetEnvCacheForTests();
    expect(hasMusicProviderCredentials()).toBe(true);
  });
});
