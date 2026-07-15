import { z } from "zod";

/**
 * Route segments and platform-meaningful words a tenant slug must never
 * collide with — `/store/app`, `/store/api`, etc. would otherwise shadow
 * real routes or read as confusingly official.
 */
export const RESERVED_TENANT_SLUGS = [
  "app",
  "admin",
  "api",
  "login",
  "signup",
  "store",
  "support",
  "settings",
  "billing",
  "system",
  "www",
  "mail",
  "assets",
  "static",
  "public",
  "docs",
  "help",
  "about",
  "contact",
  "pricing",
  "terms",
  "privacy",
  "marketplace",
  "academy",
  "equipment",
  "services",
  "onboarding",
  "kushprintco",
  "divinexai",
  "root",
  "null",
  "undefined",
] as const;

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Lowercases, trims, and hyphenates a raw brand-name-ish string into a
 * candidate slug. Purely mechanical — callers must still run the result
 * through `tenantSlugSchema` before trusting it.
 */
export function normalizeTenantSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export const tenantSlugSchema = z
  .string()
  .min(3, "Must be at least 3 characters")
  .max(63, "Must be at most 63 characters")
  .regex(
    SLUG_PATTERN,
    "Only lowercase letters, numbers, and single hyphens between words",
  )
  .refine(
    (slug) => !RESERVED_TENANT_SLUGS.includes(slug as (typeof RESERVED_TENANT_SLUGS)[number]),
    { message: "This name is reserved — please choose another" },
  );

export const createTenantSchema = z.object({
  tenantName: z.string().min(2, "Brand name is required").max(120),
  tenantSlug: tenantSlugSchema,
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
