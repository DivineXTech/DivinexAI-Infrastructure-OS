import "server-only";
import { z } from "zod";

/**
 * Single source of truth for every environment variable the app reads.
 * Nothing outside this module should touch `process.env` directly (aside
 * from the two NEXT_PUBLIC_ values the browser Supabase client needs,
 * which Next.js inlines at build time and are validated here too).
 *
 * Every provider credential is optional by design: the app must stay
 * functional with zero credentials configured, falling back to deterministic
 * mock providers ("Simulation Mode") rather than crashing at boot. What is
 * NOT optional is honesty about which mode is active — see
 * src/providers/health.ts and the /providers status screen.
 */

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const envSchema = z.object({
  // --- Anthropic (idea generation, scripts, scene plans, structured output) ---
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: optionalString.default("claude-sonnet-4-5"),

  // --- Supabase (Postgres, Auth, Storage) ---
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_STORAGE_BUCKET: optionalString.default("atlas-media"),

  // --- Durable execution (Inngest) ---
  INNGEST_EVENT_KEY: optionalString,
  INNGEST_SIGNING_KEY: optionalString,

  // --- ElevenLabs (narration — Multilingual v2) ---
  ELEVENLABS_API_KEY: optionalString,
  ELEVENLABS_VOICE_ID: optionalString,
  ELEVENLABS_MODEL_ID: optionalString.default("eleven_multilingual_v2"),

  // --- Video generation provider (pluggable; vendor-neutral HTTP contract) ---
  VIDEO_PROVIDER: z.enum(["mock", "http"]).default("mock"),
  VIDEO_PROVIDER_BASE_URL: optionalUrl,
  VIDEO_PROVIDER_API_KEY: optionalString,
  VIDEO_WEBHOOK_SECRET: optionalString,

  // --- Music provider (pluggable; vendor-neutral HTTP contract) ---
  MUSIC_PROVIDER: z.enum(["mock", "http"]).default("mock"),
  MUSIC_PROVIDER_BASE_URL: optionalUrl,
  MUSIC_PROVIDER_API_KEY: optionalString,
  MUSIC_WEBHOOK_SECRET: optionalString,

  // --- Publishing provider (pluggable; vendor-neutral HTTP contract) ---
  PUBLISHING_PROVIDER: z.enum(["mock", "http"]).default("mock"),
  PUBLISHING_PROVIDER_BASE_URL: optionalUrl,
  PUBLISHING_PROVIDER_API_KEY: optionalString,

  // --- Composition (Remotion + FFmpeg) ---
  FFMPEG_PATH: optionalString.default("ffmpeg"),
  REMOTION_CHROMIUM_EXECUTABLE: optionalString,

  // --- App ---
  NEXT_PUBLIC_APP_URL: optionalUrl.default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Parses and validates process.env once per process. Throws only on
 *  malformed values (bad enum, invalid URL) — missing optional credentials
 *  are not an error, they're a signal to run that capability in simulation
 *  mode. */
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  cached = parsed.data;
  return cached;
}

/** Test-only: clears the memoized env so tests can re-parse after mutating
 *  process.env. */
export function resetEnvCacheForTests(): void {
  cached = null;
}

export function hasSupabaseCredentials(env: Env = getEnv()): boolean {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function hasAnthropicCredentials(env: Env = getEnv()): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

export function hasElevenLabsCredentials(env: Env = getEnv()): boolean {
  return Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID);
}

export function hasVideoProviderCredentials(env: Env = getEnv()): boolean {
  return (
    env.VIDEO_PROVIDER === "http" &&
    Boolean(env.VIDEO_PROVIDER_BASE_URL && env.VIDEO_PROVIDER_API_KEY)
  );
}

export function hasMusicProviderCredentials(env: Env = getEnv()): boolean {
  return (
    env.MUSIC_PROVIDER === "http" &&
    Boolean(env.MUSIC_PROVIDER_BASE_URL && env.MUSIC_PROVIDER_API_KEY)
  );
}

export function hasPublishingProviderCredentials(env: Env = getEnv()): boolean {
  return (
    env.PUBLISHING_PROVIDER === "http" &&
    Boolean(env.PUBLISHING_PROVIDER_BASE_URL && env.PUBLISHING_PROVIDER_API_KEY)
  );
}
