/**
 * Central place that reads optional external-service configuration.
 *
 * Nothing here throws at import time. Every integration in this codebase
 * (Supabase, Resend, analytics) is expected to run without credentials in
 * local development — each module checks the relevant `isXConfigured()`
 * flag and falls back to an in-memory/console implementation instead of
 * crashing. See SETUP.md for how to provision real credentials.
 *
 * That fallback is dev/preview-only. `isRunningInProduction()` gates a hard
 * fail in the store/email/token modules so a real production deployment can
 * never silently run on in-memory data, console-only email, or a forgeable
 * link secret — see subscriber-store.ts, email/resend.ts, security/tokens.ts.
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

/**
 * True only for a real Vercel Production deployment (`VERCEL_ENV ===
 * "production"`, set automatically by Vercel — never by this app).
 *
 * Deliberately NOT based on `NODE_ENV`: `next build` and `next start` both
 * set `NODE_ENV=production` for local prod-mode smoke testing, Docker
 * images, and this repo's own CI/Playwright run — none of which should be
 * forced to configure Supabase/Resend/APP_TOKEN_SECRET. Vercel Preview
 * deployments get `VERCEL_ENV=preview` and correctly keep using the dev
 * fallbacks too, per SETUP.md.
 *
 * Self-hosting outside Vercel: set `VERCEL_ENV=production` explicitly in
 * your real production environment to get the same protection.
 */
export function isRunningInProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

let warnedAboutTokenSecret = false;

/**
 * Throws if running in production with the public dev-fallback token
 * secret (that secret is in this repo's source, so anyone could forge
 * Chapter 12 / status / unsubscribe links with it). Otherwise just warns
 * once, matching the dev-fallback behavior of the store/email modules.
 */
export function assertTokenSecretConfigured(): void {
  if (!isUsingDevTokenSecret()) return;

  if (isRunningInProduction()) {
    throw new Error(
      "APP_TOKEN_SECRET is not configured in production. Refusing to sign links " +
        "with the public dev-fallback secret — anyone could forge Chapter 12 / " +
        "status / unsubscribe access. Set APP_TOKEN_SECRET (openssl rand -hex 32) " +
        "in the Vercel project's Production environment variables. See SETUP.md.",
    );
  }

  if (!warnedAboutTokenSecret) {
    warnedAboutTokenSecret = true;
    console.warn(
      "[env] APP_TOKEN_SECRET is not set. Falling back to an insecure development " +
        "secret. Set APP_TOKEN_SECRET before deploying so Chapter 12 / status / " +
        "unsubscribe links cannot be forged.",
    );
  }
}
