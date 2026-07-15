import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  PAYMENTS_MODE: z.enum(["mock", "live"]).default("mock"),
  STRIPE_SECRET_KEY: z.string().optional(),
  DIVINEXAI_API_BASE_URL: z.string().url().optional(),
  DIVINEXAI_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
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
  return parsed.data;
}

export const serverEnv = loadServerEnv();

export const isMockPaymentsMode = serverEnv.PAYMENTS_MODE === "mock";
