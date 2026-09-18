/**
 * Single source of truth for "is this test run pointed at a real Supabase
 * project" — shared by both the Vitest integration suite
 * (tests/integration/helpers.ts) and the Playwright e2e specs
 * (tests/e2e/*.spec.ts). Previously each layer reimplemented this check
 * independently and had already drifted: the e2e copies checked only
 * `NEXT_PUBLIC_SUPABASE_URL`, while the integration copy also required a
 * non-placeholder anon key. A project with a real URL but a still-placeholder
 * anon key would have been treated as "live" by e2e and correctly skipped
 * by integration — the two suites disagreeing about environment readiness.
 * Framework-agnostic on purpose (no Next.js / server-only imports) so it's
 * safe to import from both test runners.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isLiveBackend =
  !!SUPABASE_URL &&
  !!SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes("placeholder") &&
  SUPABASE_ANON_KEY !== "placeholder-anon-key";

export const hasServiceRole = isLiveBackend && !!SUPABASE_SERVICE_ROLE_KEY;
