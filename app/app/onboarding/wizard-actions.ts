"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/log";
import { requireOnboardingStepAccess, requireOnboardingReviewAccess } from "@/lib/onboarding/guard";
import {
  getAudience,
  getBrandProfile,
  getBudgetProfile,
  getFulfillmentPreferences,
  getProductPreferences,
  getProductionPreferences,
  getStorefrontPreferences,
  overrideStartupKitSelection,
  saveAudience,
  saveBrandProfile,
  saveBudgetProfile,
  saveFulfillmentPreferences,
  saveLaunchReadinessAssessment,
  saveProductPreferences,
  saveProductionPreferences,
  saveStartupKitRecommendation,
  saveStorefrontPreferences,
} from "@/lib/onboarding/data-access";
import { calculateLaunchReadiness } from "@/lib/onboarding/launch-readiness-engine";
import { completeOnboardingSession, markStepCompleted } from "@/lib/onboarding/session";
import { nextStep } from "@/lib/onboarding/steps";
import { recommendStartupKit, type StartupKitEngineInput } from "@/lib/onboarding/startup-kit-engine";
import { buildTenantObjectPath, sanitizeFilename } from "@/lib/storage/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  audienceStepSchema,
  brandStepSchema,
  budgetStepSchema,
  fulfillmentStepSchema,
  productionStepSchema,
  productsStepSchema,
  startupKitOverrideSchema,
  storefrontStepSchema,
  type BrandStepInput,
} from "@/lib/validation/onboarding";

export type StepActionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/**
 * Every action below follows the same shape: (1) re-derive session/role
 * access server-side via requireOnboardingStepAccess — never trust that the
 * client is still allowed on this step, (2) validate with the matching Zod
 * schema, (3) upsert through lib/onboarding/data-access.ts (idempotent —
 * a duplicate submission just updates the same tenant-scoped row), (4) mark
 * the step complete/edited and advance. `saveAndExit` returns the dashboard
 * as the redirect target instead of the next step.
 */

export async function advanceWelcomeStepAction(): Promise<StepActionResult> {
  const { profile, session, stepProgress } = await requireOnboardingStepAccess("welcome");
  const isEdit = stepProgress.some((s) => s.stepKey === "welcome" && s.status === "completed");
  await markStepCompleted(session, "welcome", profile.id, { isEdit });
  revalidatePath("/app/onboarding/welcome");
  return { ok: true, redirectTo: nextStep("welcome")!.href };
}

export async function saveBrandStepAction(
  input: unknown,
  options: { saveAndExit?: boolean } = {},
): Promise<StepActionResult> {
  const { profile, session, stepProgress } = await requireOnboardingStepAccess("brand");
  const parsed = brandStepSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const isEdit = stepProgress.some((s) => s.stepKey === "brand" && s.status === "completed");
  await saveBrandProfile(session.tenantId, session.id, parsed.data);
  await markStepCompleted(session, "brand", profile.id, { isEdit });
  revalidatePath("/app/onboarding/brand");

  return { ok: true, redirectTo: options.saveAndExit ? "/app" : nextStep("brand")!.href };
}

const LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

export async function uploadBrandLogoAction(
  formData: FormData,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { profile, session } = await requireOnboardingStepAccess("brand");

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file was selected." };
  }
  if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "Logo must be a PNG, JPEG, or WebP image." };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: "Logo must be smaller than 5 MB." };
  }

  const path = buildTenantObjectPath(session.tenantId, "logo", `${Date.now()}-${sanitizeFilename(file.name)}`);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from("logos").upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) return { ok: false, error: "Upload failed. Please try again." };

  await writeAuditLog({
    tenantId: session.tenantId,
    actorProfileId: profile.id,
    action: "onboarding.logo_uploaded",
    targetTable: "brand_profiles",
    metadata: { path },
  });

  return { ok: true, path };
}

export async function removeBrandLogoAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { profile, session } = await requireOnboardingStepAccess("brand");
  const existing = await getBrandProfile(session.tenantId);
  if (!existing?.logoPath) return { ok: true };

  const supabase = await createSupabaseServerClient();
  await supabase.storage.from("logos").remove([existing.logoPath]);

  await saveBrandProfile(session.tenantId, session.id, {
    brandName: existing.brandName,
    tagline: existing.tagline ?? "",
    description: existing.description ?? "",
    primaryColor: existing.primaryColor ?? "",
    secondaryColor: existing.secondaryColor ?? "",
    accentColor: existing.accentColor ?? "",
    typography: existing.typography ?? "",
    personality: (existing.personality ?? undefined) as BrandStepInput["personality"],
    personalityOther: existing.personalityOther ?? "",
    existingWebsite: existing.existingWebsite ?? "",
    logoPath: "",
  });

  await writeAuditLog({
    tenantId: session.tenantId,
    actorProfileId: profile.id,
    action: "onboarding.logo_removed",
    targetTable: "brand_profiles",
  });

  return { ok: true };
}

export async function saveAudienceStepAction(
  input: unknown,
  options: { saveAndExit?: boolean } = {},
): Promise<StepActionResult> {
  const { profile, session, stepProgress } = await requireOnboardingStepAccess("audience");
  const parsed = audienceStepSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const isEdit = stepProgress.some((s) => s.stepKey === "audience" && s.status === "completed");
  await saveAudience(session.tenantId, session.id, parsed.data);
  await markStepCompleted(session, "audience", profile.id, { isEdit });
  revalidatePath("/app/onboarding/audience");

  return { ok: true, redirectTo: options.saveAndExit ? "/app" : nextStep("audience")!.href };
}

export async function saveProductsStepAction(
  input: unknown,
  options: { saveAndExit?: boolean } = {},
): Promise<StepActionResult> {
  const { profile, session, stepProgress } = await requireOnboardingStepAccess("products");
  const parsed = productsStepSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const isEdit = stepProgress.some((s) => s.stepKey === "products" && s.status === "completed");
  await saveProductPreferences(session.tenantId, session.id, parsed.data);
  await markStepCompleted(session, "products", profile.id, { isEdit });
  revalidatePath("/app/onboarding/products");

  return { ok: true, redirectTo: options.saveAndExit ? "/app" : nextStep("products")!.href };
}

export async function saveProductionStepAction(
  input: unknown,
  options: { saveAndExit?: boolean } = {},
): Promise<StepActionResult> {
  const { profile, session, stepProgress } = await requireOnboardingStepAccess("production");
  const parsed = productionStepSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const isEdit = stepProgress.some((s) => s.stepKey === "production" && s.status === "completed");
  await saveProductionPreferences(session.tenantId, session.id, parsed.data);
  await markStepCompleted(session, "production", profile.id, { isEdit });
  revalidatePath("/app/onboarding/production");

  return { ok: true, redirectTo: options.saveAndExit ? "/app" : nextStep("production")!.href };
}

export async function saveBudgetStepAction(
  input: unknown,
  options: { saveAndExit?: boolean } = {},
): Promise<StepActionResult> {
  const { profile, session, stepProgress } = await requireOnboardingStepAccess("budget");
  const parsed = budgetStepSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const isEdit = stepProgress.some((s) => s.stepKey === "budget" && s.status === "completed");
  await saveBudgetProfile(session.tenantId, session.id, parsed.data);
  await markStepCompleted(session, "budget", profile.id, { isEdit });
  revalidatePath("/app/onboarding/budget");

  return { ok: true, redirectTo: options.saveAndExit ? "/app" : nextStep("budget")!.href };
}

/**
 * Recomputes the startup-kit recommendation from whatever production/
 * product/budget data has been saved so far. Called on entering the
 * startup-kit step and whenever the founder asks to recalculate — never
 * cached client-side, since section 10 requires recalculation whenever a
 * relevant upstream answer changes.
 */
export async function generateStartupKitRecommendationAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { profile, session } = await requireOnboardingStepAccess("startup_kit");

  const [production, products, budget] = await Promise.all([
    getProductionPreferences(session.tenantId),
    getProductPreferences(session.tenantId),
    getBudgetProfile(session.tenantId),
  ]);

  const engineInput: StartupKitEngineInput = {
    budgetBand: (budget?.budgetBand ?? "custom_undecided") as StartupKitEngineInput["budgetBand"],
    productCategories: products?.categories ?? [],
    productionMethod: (production?.preferredMethod ?? null) as StartupKitEngineInput["productionMethod"],
    monthlyOrderVolume: production?.expectedMonthlyVolume ?? null,
    workspace: (production?.workspace ?? null) as StartupKitEngineInput["workspace"],
    experienceLevel: production?.experienceLevel ?? null,
    equipmentOwned: production?.equipmentOwned ?? false,
    growthObjective: null,
  };

  const recommendation = recommendStartupKit(engineInput);
  await saveStartupKitRecommendation(session.tenantId, session.id, recommendation);
  await writeAuditLog({
    tenantId: session.tenantId,
    actorProfileId: profile.id,
    action: "onboarding.startup_kit_recommended",
    targetTable: "startup_kit_recommendations",
    metadata: { recommendedKitSlug: recommendation.recommendedKitSlug, ruleVersion: recommendation.ruleVersion },
  });
  revalidatePath("/app/onboarding/startup-kit");

  return { ok: true };
}

/**
 * Explicitly advances past the startup-kit step, separate from generating
 * the recommendation — the founder must be able to see the recommendation
 * and optionally override it (overrideStartupKitAction) before the step is
 * marked complete and the wizard moves on.
 */
export async function confirmStartupKitStepAction(): Promise<StepActionResult> {
  const { profile, session, stepProgress } = await requireOnboardingStepAccess("startup_kit");
  const isEdit = stepProgress.some((s) => s.stepKey === "startup_kit" && s.status === "completed");
  await markStepCompleted(session, "startup_kit", profile.id, { isEdit });
  revalidatePath("/app/onboarding/startup-kit");
  return { ok: true, redirectTo: nextStep("startup_kit")!.href };
}

export async function overrideStartupKitAction(
  input: unknown,
): Promise<StepActionResult> {
  const { profile, session } = await requireOnboardingStepAccess("startup_kit");
  const parsed = startupKitOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await overrideStartupKitSelection(session.tenantId, parsed.data.selectedKitSlug);
  await writeAuditLog({
    tenantId: session.tenantId,
    actorProfileId: profile.id,
    action: "onboarding.startup_kit_overridden",
    targetTable: "startup_kit_recommendations",
    metadata: { selectedKitSlug: parsed.data.selectedKitSlug },
  });
  revalidatePath("/app/onboarding/startup-kit");

  return { ok: true, redirectTo: "/app/onboarding/startup-kit" };
}

export async function saveStorefrontStepAction(
  input: unknown,
  options: { saveAndExit?: boolean } = {},
): Promise<StepActionResult> {
  const { profile, session, stepProgress } = await requireOnboardingStepAccess("storefront");
  const parsed = storefrontStepSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const isEdit = stepProgress.some((s) => s.stepKey === "storefront" && s.status === "completed");
  await saveStorefrontPreferences(session.tenantId, session.id, parsed.data);
  await markStepCompleted(session, "storefront", profile.id, { isEdit });
  revalidatePath("/app/onboarding/storefront");

  return { ok: true, redirectTo: options.saveAndExit ? "/app" : nextStep("storefront")!.href };
}

export async function saveFulfillmentStepAction(
  input: unknown,
  options: { saveAndExit?: boolean } = {},
): Promise<StepActionResult> {
  const { profile, session, stepProgress } = await requireOnboardingStepAccess("fulfillment");
  const parsed = fulfillmentStepSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const isEdit = stepProgress.some((s) => s.stepKey === "fulfillment" && s.status === "completed");
  await saveFulfillmentPreferences(session.tenantId, session.id, parsed.data);
  await markStepCompleted(session, "fulfillment", profile.id, { isEdit });
  revalidatePath("/app/onboarding/fulfillment");

  return { ok: true, redirectTo: options.saveAndExit ? "/app" : nextStep("fulfillment")!.href };
}

/**
 * Recomputes and persists the launch-readiness assessment from every
 * saved step's data. Owner/admin only — this mirrors the RLS policy on
 * launch_readiness_assessments (owner/admin only, no designer/production
 * read), so a scoped reviewer role is never even offered this action.
 */
export async function recalculateLaunchReadinessAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const access = await requireOnboardingReviewAccess();
  if (!access.canEdit || !access.session) {
    return { ok: false, error: "You don't have permission to update launch readiness." };
  }
  const { session } = access;

  const [brand, audience, products, production, budget, storefront, fulfillment] = await Promise.all([
    getBrandProfile(session.tenantId),
    getAudience(session.tenantId),
    getProductPreferences(session.tenantId),
    getProductionPreferences(session.tenantId),
    getBudgetProfile(session.tenantId),
    getStorefrontPreferences(session.tenantId),
    getFulfillmentPreferences(session.tenantId),
  ]);

  const result = calculateLaunchReadiness({
    brand: brand
      ? {
          hasBrandName: !!brand.brandName,
          hasLogo: !!brand.logoPath,
          hasColors: !!brand.primaryColor,
          hasPersonality: !!brand.personality,
          hasDescription: !!brand.description,
        }
      : null,
    audience: audience
      ? {
          hasCustomerTypes: audience.customerTypes.length > 0,
          hasAgeRanges: audience.ageRanges.length > 0,
          hasMarketType: !!audience.marketType,
          hasStylePreferences: audience.stylePreferences.length > 0,
        }
      : null,
    products: products
      ? {
          hasCategories: products.categories.length > 0,
          hasLaunchQuantity: products.launchQuantity !== null,
          hasDesignCount: products.initialDesignCount !== null,
          hasPriceRange: products.targetPriceMinCents !== null || products.targetPriceMaxCents !== null,
          hasSalesModel: !!products.salesModel,
        }
      : null,
    production: production
      ? {
          hasPreferredMethod: !!production.preferredMethod,
          hasExperienceLevel: !!production.experienceLevel,
          hasWorkspace: !!production.workspace,
          hasVolumeEstimate: production.expectedMonthlyVolume !== null,
          equipmentDecisionMade: production.equipmentOwned || !!production.existingEquipment,
        }
      : null,
    budget: budget
      ? {
          hasBudgetBand: !!budget.budgetBand,
          hasAllocations: budget.preciseTotalCents !== null,
        }
      : null,
    storefront: storefront
      ? {
          hasStorefrontName: !!storefront.storefrontName,
          hasThemeDirection: !!storefront.themeDirection,
          hasDomainStatus: !!storefront.domainStatus,
          hasPaymentMethodPreferences: Object.keys(storefront.plannedPaymentMethods).length > 0,
        }
      : null,
    fulfillment: fulfillment
      ? {
          hasFulfillmentModel: !!fulfillment.fulfillmentModel,
          hasLeadTime: fulfillment.productionLeadTimeDays !== null,
          hasReturnPolicyStatus: !!fulfillment.returnPolicyStatus,
          hasShippingRegions: fulfillment.shippingRegions.length > 0,
        }
      : null,
    compliance: fulfillment
      ? {
          returnPolicyDefined: fulfillment.returnPolicyStatus === "defined",
          qcResponsibilityAssigned: !!fulfillment.qcResponsibility,
          budgetPlanned: !!budget?.budgetBand,
        }
      : null,
  });

  await saveLaunchReadinessAssessment(session.tenantId, session.id, result);
  revalidatePath("/app/onboarding/review");

  return { ok: true };
}

export async function completeOnboardingAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const access = await requireOnboardingReviewAccess();
  if (!access.canEdit || !access.session) {
    return { ok: false, error: "You don't have permission to complete onboarding." };
  }
  const { session, profile } = access;

  await markStepCompleted(session, "review", profile.id, {
    isEdit: access.stepProgress.some((s) => s.stepKey === "review" && s.status === "completed"),
  });
  await completeOnboardingSession(session, profile.id);
  revalidatePath("/app/onboarding/review");
  revalidatePath("/app/onboarding/complete");
  revalidatePath("/app");

  return { ok: true };
}
