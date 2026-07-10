import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("FlowraMarket Africa"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  PAYMENT_MODE: z.enum(["mock", "live"]).default("mock"),
  PLATFORM_DEFAULT_CURRENCY: z.string().default("USD"),
  PLATFORM_SUPPORT_EMAIL: z.string().default("support@flowramarket.africa"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/**
 * Lazily-validated environment access. Supabase-backed features degrade to
 * a clear "not configured" state (see modules/supabase-status) rather than
 * throwing at import time, so the app still builds and runs without a
 * connected Supabase project (e.g. this repo's own CI/build sandbox).
 */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  cached = serverEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PAYMENT_MODE: process.env.PAYMENT_MODE,
    PLATFORM_DEFAULT_CURRENCY: process.env.PLATFORM_DEFAULT_CURRENCY,
    PLATFORM_SUPPORT_EMAIL: process.env.PLATFORM_SUPPORT_EMAIL,
  });
  return cached;
}

export function isSupabaseConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
