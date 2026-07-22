/**
 * Central place that reads optional external-service configuration.
 *
 * Nothing here throws at import time. Every integration in this codebase
 * (Supabase, Resend, analytics) is expected to run without credentials in
 * local development — each module checks the relevant `isXConfigured()`
 * flag and falls back to an in-memory/console implementation instead of
 * crashing. See SETUP.md for how to provision real credentials.
 */

const DEV_FALLBACK_TOKEN_SECRET = "dev-only-insecure-secret-do-not-use-in-production";

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000",

  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  resendApiKey: process.env.RESEND_API_KEY,

  tokenSecret: process.env.APP_TOKEN_SECRET || DEV_FALLBACK_TOKEN_SECRET,

  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
  gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export function isResendConfigured(): boolean {
  return Boolean(env.resendApiKey);
}

export function isUsingDevTokenSecret(): boolean {
  return env.tokenSecret === DEV_FALLBACK_TOKEN_SECRET;
}

let warnedAboutTokenSecret = false;
export function warnIfDevTokenSecret(): void {
  if (isUsingDevTokenSecret() && !warnedAboutTokenSecret) {
    warnedAboutTokenSecret = true;
    console.warn(
      "[env] APP_TOKEN_SECRET is not set. Falling back to an insecure development " +
        "secret. Set APP_TOKEN_SECRET before deploying so Chapter 12 / status / " +
        "unsubscribe links cannot be forged.",
    );
  }
}
