import "server-only";

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

  adminPassword: process.env.ADMIN_PASSWORD,

  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripeProductId: process.env.STRIPE_PRODUCT_ID || "prod_UtmvlaWO7E0RY1",
  checkoutEnabled: process.env.NEXT_PUBLIC_CHECKOUT_ENABLED === "true",

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

export function isAdminPasswordConfigured(): boolean {
  return Boolean(env.adminPassword && env.adminPassword.length >= 12);
}

export function isStripeConfigured(): boolean {
  return Boolean(env.stripeSecretKey && env.stripeWebhookSecret);
}

export type AppEnvironment = "production" | "preview" | "development";

const VALID_APP_ENVIRONMENTS: readonly AppEnvironment[] = ["production", "preview", "development"];

/**
 * Resolves which environment tier this process is running as, independent
 * of hosting platform:
 *
 * 1. `APP_ENV` — an explicit, platform-agnostic signal. Set this yourself
 *    on any non-Vercel host (a VPS, Docker, Railway, Fly.io, ...) to get
 *    the same production protections Vercel gets automatically.
 * 2. `VERCEL_ENV` — set automatically by Vercel ("production" | "preview"
 *    | "development"). Used only when `APP_ENV` isn't set, so Vercel
 *    deployments need zero extra configuration.
 * 3. Otherwise `"development"` — the safe default. Deliberately NOT derived
 *    from `NODE_ENV`: `next build` / `next start` always set
 *    `NODE_ENV=production`, including for local prod-mode smoke testing,
 *    Docker image builds, and this repo's own CI/Playwright run — none of
 *    which should be forced to configure Supabase/Resend/APP_TOKEN_SECRET.
 */
export function resolveAppEnvironment(): AppEnvironment {
  const explicit = process.env.APP_ENV;
  if (explicit && (VALID_APP_ENVIRONMENTS as readonly string[]).includes(explicit)) {
    return explicit as AppEnvironment;
  }
  if (explicit) {
    console.warn(
      `[env] APP_ENV="${explicit}" is not one of ${VALID_APP_ENVIRONMENTS.join(", ")}. ` +
        "Ignoring it and falling back to VERCEL_ENV / development.",
    );
  }

  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview") return "preview";
  if (process.env.VERCEL_ENV === "development") return "development";

  return "development";
}

/** True only for a real production deployment — see `resolveAppEnvironment()`. */
export function isRunningInProduction(): boolean {
  return resolveAppEnvironment() === "production";
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
