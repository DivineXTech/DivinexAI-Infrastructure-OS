import { z } from "zod";

/**
 * Environment variables this package needs directly (the Supabase client
 * factories below). Convention adopted from MediaForgeOS's `apps/backend/src/env.ts`:
 * parse once at import time, fail fast on a missing/invalid value, export a
 * typed `env` object — never read `process.env` ad hoc elsewhere.
 *
 * SUPABASE_SERVICE_ROLE_KEY must never reach a browser bundle. Anything that
 * imports `createServiceRoleClient` must be server-only code.
 */
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Lazily parsed so importing this module doesn't crash code paths (e.g. unit
 * tests of pure functions elsewhere in the package) that never need Supabase
 * credentials. Anything that actually calls a Supabase client factory pays
 * the validation cost, with a clear error naming the missing variable.
 */
export function getEnv(): Env {
  if (!cached) {
    cached = envSchema.parse(process.env);
  }
  return cached;
}
