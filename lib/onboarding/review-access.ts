import type { RoleKey } from "@/lib/auth/roles";

/**
 * Pure role → review-page-access mapping, extracted out of
 * lib/onboarding/guard.ts so it's unit-testable without pulling in
 * `server-only`/Supabase imports (the same pattern used for
 * lib/auth/tenant-selection.ts) — only a type-only import of `RoleKey`
 * crosses that boundary, which TypeScript erases at compile time.
 */
export const ONBOARDING_EDIT_ROLES: RoleKey[] = ["tenant_owner", "tenant_admin"];

export const REVIEW_ROLES: RoleKey[] = [
  "tenant_owner",
  "tenant_admin",
  "designer",
  "production_manager",
];

export type OnboardingReviewSection =
  | "brand"
  | "audience"
  | "products"
  | "production"
  | "budget"
  | "startup_kit"
  | "storefront"
  | "fulfillment";

const ALL_SECTIONS: OnboardingReviewSection[] = [
  "brand",
  "audience",
  "products",
  "production",
  "budget",
  "startup_kit",
  "storefront",
  "fulfillment",
];

export type ReviewAccessResult = {
  allowed: boolean;
  canEdit: boolean;
  visibleSections: OnboardingReviewSection[];
};

/**
 * Never derives access from a client-submitted role — callers must pass
 * `roleKey`/`isPlatformSuperAdmin` resolved server-side from the caller's
 * own authenticated membership row (lib/onboarding/guard.ts), never from
 * request input.
 */
export function computeReviewAccess(
  roleKey: RoleKey,
  isPlatformSuperAdmin: boolean,
): ReviewAccessResult {
  const allowed = isPlatformSuperAdmin || REVIEW_ROLES.includes(roleKey);
  if (!allowed) {
    return { allowed: false, canEdit: false, visibleSections: [] };
  }

  const canEdit = isPlatformSuperAdmin || ONBOARDING_EDIT_ROLES.includes(roleKey);
  let visibleSections: OnboardingReviewSection[] = [];
  if (canEdit) {
    visibleSections = ALL_SECTIONS;
  } else if (roleKey === "designer") {
    visibleSections = ["brand", "products"];
  } else if (roleKey === "production_manager") {
    visibleSections = ["production"];
  }

  return { allowed, canEdit, visibleSections };
}
