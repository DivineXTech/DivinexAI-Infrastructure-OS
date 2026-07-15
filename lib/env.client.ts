import "client-only";
import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/**
 * Only `NEXT_PUBLIC_*` variables may live here, and each must be a direct
 * `process.env.NEXT_PUBLIC_X` reference (not a spread of `process.env`) so
 * Next.js can inline it into the browser bundle at build time.
 */
function loadClientEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid public environment configuration. See .env.example.\n${issues}`,
    );
  }
  return parsed.data;
}

export const clientEnv = loadClientEnv();
