import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  PAYMENTS_MODE: z.enum(["mock", "live"]).default("mock"),
  STRIPE_SECRET_KEY: z.string().optional(),
  DIVINEXAI_API_BASE_URL: z.string().url().optional(),
  DIVINEXAI_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Dev-only master switch for scripts/seed.ts. Never "true" in production
   * — see the guard below and docs/DATABASE.md. */
  SEED_MODE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates process.env once per process. Throws with a readable message
 * instead of failing later with an obscure runtime error (e.g. a Supabase
 * client silently pointed at `undefined`). Server-only: importing this from
 * a Client Component is a build error by design, so secrets can never reach
 * the browser bundle through this module.
 */
function loadServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration. See .env.example.\n${issues}`,
    );
  }

  // Defense in depth: even if something sets SEED_MODE_ENABLED=true in a
  // production environment by mistake, refuse to consider the process
  // validly configured rather than letting scripts/seed.ts decide alone.
  if (parsed.data.NODE_ENV === "production" && parsed.data.SEED_MODE_ENABLED) {
    throw new Error(
      "SEED_MODE_ENABLED=true is not allowed when NODE_ENV=production. Seed data must never run against production.",
    );
  }

  return parsed.data;
}

export const serverEnv = loadServerEnv();

export const isMockPaymentsMode = serverEnv.PAYMENTS_MODE === "mock";
