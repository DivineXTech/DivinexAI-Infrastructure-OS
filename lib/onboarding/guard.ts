import "server-only";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/audit/log";
import {
  getCurrentProfile,
  getCurrentTenantMembership,
  requireCurrentTenantRole,
  type AuthedProfile,
  type TenantMembership,
} from "@/lib/auth/session";
import { computeCurrentStep, isStepAccessible, type StepProgressRow } from "@/lib/onboarding/progress";
import { computeReviewAccess, ONBOARDING_EDIT_ROLES, type OnboardingReviewSection } from "@/lib/onboarding/review-access";
import {
  getOnboardingSession,
  getStepProgress,
  startOrResumeOnboardingSession,
  type OnboardingSession,
} from "@/lib/onboarding/session";
import { stepMeta, type StepKey } from "@/lib/onboarding/steps";

export { ONBOARDING_EDIT_ROLES };

/**
 * Only tenant_owner/tenant_admin can run the edit wizard (section 17):
 * "Authorized manager" is not implemented as a distinct role in this
 * phase — the existing role model has no such tier, and adding one is
 * out of scope for a bounded onboarding interface (see docs/ONBOARDING.md
 * "Authorization model" for the full rationale). Extending granular
 * per-user entitlements is deferred to the permissions/role_permissions
 * tables already reserved for that purpose. The role→access mapping
 * itself lives in lib/onboarding/review-access.ts (pure, unit-tested);
 * this file only wires it to the authenticated session.
 */

export type OnboardingStepContext = {
  profile: AuthedProfile;
  membership: TenantMembership;
  session: OnboardingSession;
  stepProgress: StepProgressRow[];
};

/**
 * Server-side gate for every wizard step page (welcome through
 * fulfillment). One function, reused by every step page instead of
 * per-page copy-pasted role/session/step-order checks — see
 * docs/TECH_DEBT.md item 4 (the same duplication pattern flagged in the
 * pre-Phase-3 review for /app/* stub pages, deliberately not repeated
 * here).
 *
 * Order of operations: (1) authenticate via the caller's own session
 * (never a client-submitted role), (2) resolve/auto-start the tenant's
 * onboarding session, (3) enforce step ordering by redirecting to the
 * current step if the requested one is locked ahead of it.
 */
export async function requireOnboardingStepAccess(
  requestedStep: StepKey,
): Promise<OnboardingStepContext> {
  const membership = await requireCurrentTenantRole(ONBOARDING_EDIT_ROLES);
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  let session = await getOnboardingSession(membership.tenantId);
  if (!session) {
    session = await startOrResumeOnboardingSession(membership.tenantId, profile.id);
  }

  const stepProgress = await getStepProgress(membership.tenantId, session.id);

  if (!isStepAccessible(requestedStep, stepProgress)) {
    const current = computeCurrentStep(stepProgress);
    redirect(stepMeta(current).href);
  }

  return { profile, membership, session, stepProgress };
}

export type { OnboardingReviewSection };

export type OnboardingReviewAccess = {
  profile: AuthedProfile;
  membership: TenantMembership;
  session: OnboardingSession | null;
  stepProgress: StepProgressRow[];
  canEdit: boolean;
  visibleSections: OnboardingReviewSection[];
};

/**
 * Broader (read-scoped) gate for /app/onboarding/review: tenant_owner/
 * tenant_admin see and can edit everything; designer sees brand+products
 * only, read-only; production_manager sees production only, read-only.
 * Every other role is denied. This mirrors the RLS policies on
 * brand_profiles/brand_product_preferences/production_preferences
 * exactly (supabase/migrations/20260718000000_onboarding.sql) — the
 * application-layer section visibility here is a UX nicety on top of
 * that, not a substitute for it.
 */
export async function requireOnboardingReviewAccess(): Promise<OnboardingReviewAccess> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/app/onboarding");
  if (membership.status !== "active") redirect("/app");

  const access = computeReviewAccess(membership.roleKey, profile.isPlatformSuperAdmin);
  if (!access.allowed) {
    await writeAuditLog({
      tenantId: membership.tenantId,
      actorProfileId: profile.id,
      action: "privileged_action.denied",
      metadata: { actualRole: membership.roleKey },
    });
    redirect("/app");
  }
  const { canEdit, visibleSections } = access;

  const session = await getOnboardingSession(membership.tenantId);
  const stepProgress = session
    ? await getStepProgress(membership.tenantId, session.id)
    : [];

  return { profile, membership, session, stepProgress, canEdit, visibleSections };
}
