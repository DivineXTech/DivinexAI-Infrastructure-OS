import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type {
  AudienceStepInput,
  BrandStepInput,
  BudgetStepInput,
  FulfillmentStepInput,
  ProductionStepInput,
  ProductsStepInput,
  StorefrontStepInput,
} from "@/lib/validation/onboarding";
import { isKitOverridden, type StartupKitRecommendation } from "@/lib/onboarding/startup-kit-engine";
import type { LaunchReadinessResult } from "@/lib/onboarding/launch-readiness-engine";

/**
 * Every function below takes an explicit `tenantId` (resolved server-side
 * by the caller from the authenticated session — see
 * lib/onboarding/guard.ts — never from client input) and filters by it
 * explicitly, in addition to whatever RLS also enforces. Each table is
 * one row per tenant (`tenant_id unique`), so upserting on `tenant_id` is
 * what makes every save here idempotent — a refresh or duplicate
 * submission updates the same row rather than creating a second one.
 */

// ---------------------------------------------------------------------------
// brand_profiles
// ---------------------------------------------------------------------------
export type BrandProfileRow = {
  brandName: string;
  tagline: string | null;
  description: string | null;
  logoPath: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  typography: string | null;
  personality: string | null;
  personalityOther: string | null;
  existingWebsite: string | null;
};

export async function getBrandProfile(tenantId: string): Promise<BrandProfileRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("brand_profiles")
    .select(
      "brand_name, tagline, description, logo_path, primary_color, secondary_color, accent_color, typography, personality, personality_other, existing_website",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    brandName: data.brand_name,
    tagline: data.tagline,
    description: data.description,
    logoPath: data.logo_path,
    primaryColor: data.primary_color,
    secondaryColor: data.secondary_color,
    accentColor: data.accent_color,
    typography: data.typography,
    personality: data.personality,
    personalityOther: data.personality_other,
    existingWebsite: data.existing_website,
  };
}

export async function saveBrandProfile(
  tenantId: string,
  sessionId: string,
  input: BrandStepInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("brand_profiles").upsert(
    {
      tenant_id: tenantId,
      session_id: sessionId,
      brand_name: input.brandName,
      tagline: input.tagline || null,
      description: input.description || null,
      logo_path: input.logoPath || null,
      primary_color: input.primaryColor || null,
      secondary_color: input.secondaryColor || null,
      accent_color: input.accentColor || null,
      typography: input.typography || null,
      personality: input.personality ?? null,
      personality_other: input.personalityOther || null,
      existing_website: input.existingWebsite || null,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(`Failed to save brand profile: ${error.message}`);
}

// ---------------------------------------------------------------------------
// brand_audiences
// ---------------------------------------------------------------------------
export type AudienceRow = {
  customerTypes: string[];
  ageRanges: string[];
  geographicFocus: string | null;
  marketType: "b2c" | "b2b" | "both" | null;
  stylePreferences: string[];
  purchaseMotivation: string | null;
  priceSensitivity: string | null;
  primarySalesChannel: string | null;
};

export async function getAudience(tenantId: string): Promise<AudienceRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("brand_audiences")
    .select(
      "customer_types, age_ranges, geographic_focus, market_type, style_preferences, purchase_motivation, price_sensitivity, primary_sales_channel",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    customerTypes: data.customer_types,
    ageRanges: data.age_ranges,
    geographicFocus: data.geographic_focus,
    marketType: data.market_type,
    stylePreferences: data.style_preferences,
    purchaseMotivation: data.purchase_motivation,
    priceSensitivity: data.price_sensitivity,
    primarySalesChannel: data.primary_sales_channel,
  };
}

export async function saveAudience(
  tenantId: string,
  sessionId: string,
  input: AudienceStepInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("brand_audiences").upsert(
    {
      tenant_id: tenantId,
      session_id: sessionId,
      customer_types: input.customerTypes,
      age_ranges: input.ageRanges,
      geographic_focus: input.geographicFocus || null,
      market_type: input.marketType ?? null,
      style_preferences: input.stylePreferences,
      purchase_motivation: input.purchaseMotivation || null,
      price_sensitivity: input.priceSensitivity || null,
      primary_sales_channel: input.primarySalesChannel || null,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(`Failed to save audience: ${error.message}`);
}

// ---------------------------------------------------------------------------
// brand_product_preferences
// ---------------------------------------------------------------------------
export type ProductPreferencesRow = {
  categories: string[];
  launchQuantity: number | null;
  initialDesignCount: number | null;
  sizeRange: string | null;
  colorRange: string | null;
  customizationRequirements: string | null;
  salesModel: "retail" | "wholesale" | "both" | null;
  targetPriceMinCents: number | null;
  targetPriceMaxCents: number | null;
};

export async function getProductPreferences(
  tenantId: string,
): Promise<ProductPreferencesRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("brand_product_preferences")
    .select(
      "categories, launch_quantity, initial_design_count, size_range, color_range, customization_requirements, sales_model, target_price_min_cents, target_price_max_cents",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    categories: data.categories,
    launchQuantity: data.launch_quantity,
    initialDesignCount: data.initial_design_count,
    sizeRange: data.size_range,
    colorRange: data.color_range,
    customizationRequirements: data.customization_requirements,
    salesModel: data.sales_model,
    targetPriceMinCents: data.target_price_min_cents,
    targetPriceMaxCents: data.target_price_max_cents,
  };
}

export async function saveProductPreferences(
  tenantId: string,
  sessionId: string,
  input: ProductsStepInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("brand_product_preferences").upsert(
    {
      tenant_id: tenantId,
      session_id: sessionId,
      categories: input.categories,
      launch_quantity: input.launchQuantity ?? null,
      initial_design_count: input.initialDesignCount ?? null,
      size_range: input.sizeRange || null,
      color_range: input.colorRange || null,
      customization_requirements: input.customizationRequirements || null,
      sales_model: input.salesModel ?? null,
      target_price_min_cents: input.targetPriceMinCents ?? null,
      target_price_max_cents: input.targetPriceMaxCents ?? null,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(`Failed to save product preferences: ${error.message}`);
}

// ---------------------------------------------------------------------------
// production_preferences
// ---------------------------------------------------------------------------
export type ProductionPreferencesRow = {
  preferredMethod: string | null;
  experienceLevel: "new" | "some_experience" | "experienced" | null;
  workspace: string | null;
  expectedMonthlyVolume: number | null;
  equipmentOwned: boolean;
  existingEquipment: string | null;
  outsourcingPreference: string | null;
};

export async function getProductionPreferences(
  tenantId: string,
): Promise<ProductionPreferencesRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("production_preferences")
    .select(
      "preferred_method, experience_level, workspace, expected_monthly_volume, equipment_owned, existing_equipment, outsourcing_preference",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    preferredMethod: data.preferred_method,
    experienceLevel: data.experience_level,
    workspace: data.workspace,
    expectedMonthlyVolume: data.expected_monthly_volume,
    equipmentOwned: data.equipment_owned,
    existingEquipment: data.existing_equipment,
    outsourcingPreference: data.outsourcing_preference,
  };
}

export async function saveProductionPreferences(
  tenantId: string,
  sessionId: string,
  input: ProductionStepInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("production_preferences").upsert(
    {
      tenant_id: tenantId,
      session_id: sessionId,
      preferred_method: input.preferredMethod ?? null,
      experience_level: input.experienceLevel ?? null,
      workspace: input.workspace ?? null,
      expected_monthly_volume: input.expectedMonthlyVolume ?? null,
      equipment_owned: input.equipmentOwned,
      existing_equipment: input.existingEquipment || null,
      outsourcing_preference: input.outsourcingPreference || null,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(`Failed to save production preferences: ${error.message}`);
}

// ---------------------------------------------------------------------------
// budget_profiles
// ---------------------------------------------------------------------------
export type BudgetProfileRow = {
  budgetBand: string;
  preciseTotalCents: number | null;
  allocationEquipmentCents: number | null;
  allocationBlankApparelCents: number | null;
  allocationBrandingCents: number | null;
  allocationStorefrontCents: number | null;
  allocationMarketingCents: number | null;
  allocationPackagingCents: number | null;
  allocationTrainingCents: number | null;
  allocationWorkingCapitalCents: number | null;
};

export async function getBudgetProfile(tenantId: string): Promise<BudgetProfileRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("budget_profiles")
    .select(
      "budget_band, precise_total_cents, allocation_equipment_cents, allocation_blank_apparel_cents, allocation_branding_cents, allocation_storefront_cents, allocation_marketing_cents, allocation_packaging_cents, allocation_training_cents, allocation_working_capital_cents",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    budgetBand: data.budget_band,
    preciseTotalCents: data.precise_total_cents,
    allocationEquipmentCents: data.allocation_equipment_cents,
    allocationBlankApparelCents: data.allocation_blank_apparel_cents,
    allocationBrandingCents: data.allocation_branding_cents,
    allocationStorefrontCents: data.allocation_storefront_cents,
    allocationMarketingCents: data.allocation_marketing_cents,
    allocationPackagingCents: data.allocation_packaging_cents,
    allocationTrainingCents: data.allocation_training_cents,
    allocationWorkingCapitalCents: data.allocation_working_capital_cents,
  };
}

export async function saveBudgetProfile(
  tenantId: string,
  sessionId: string,
  input: BudgetStepInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("budget_profiles").upsert(
    {
      tenant_id: tenantId,
      session_id: sessionId,
      budget_band: input.budgetBand,
      precise_total_cents: input.preciseTotalCents ?? null,
      allocation_equipment_cents: input.allocationEquipmentCents ?? null,
      allocation_blank_apparel_cents: input.allocationBlankApparelCents ?? null,
      allocation_branding_cents: input.allocationBrandingCents ?? null,
      allocation_storefront_cents: input.allocationStorefrontCents ?? null,
      allocation_marketing_cents: input.allocationMarketingCents ?? null,
      allocation_packaging_cents: input.allocationPackagingCents ?? null,
      allocation_training_cents: input.allocationTrainingCents ?? null,
      allocation_working_capital_cents: input.allocationWorkingCapitalCents ?? null,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(`Failed to save budget profile: ${error.message}`);
}

// ---------------------------------------------------------------------------
// startup_kit_recommendations
// ---------------------------------------------------------------------------
export type StartupKitRecommendationRow = StartupKitRecommendation & {
  userSelectedKitSlug: string | null;
  overridden: boolean;
};

export async function getStartupKitRecommendation(
  tenantId: string,
): Promise<StartupKitRecommendationRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("startup_kit_recommendations")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    recommendedKitSlug: data.recommended_kit_slug,
    secondaryKitSlug: data.secondary_kit_slug,
    score: data.score,
    explanation: data.explanation,
    requiredCategories: data.required_categories,
    optionalCategories: data.optional_categories,
    ownedItems: data.owned_items,
    estimatedRange:
      data.estimated_range_min_cents === null
        ? null
        : { minCents: data.estimated_range_min_cents, maxCents: data.estimated_range_max_cents },
    risks: data.risks,
    nextSteps: data.next_steps,
    ruleVersion: data.rule_version,
    userSelectedKitSlug: data.user_selected_kit_slug,
    overridden: data.overridden,
  };
}

export async function saveStartupKitRecommendation(
  tenantId: string,
  sessionId: string,
  recommendation: StartupKitRecommendation,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("startup_kit_recommendations").upsert(
    {
      tenant_id: tenantId,
      session_id: sessionId,
      recommended_kit_slug: recommendation.recommendedKitSlug,
      secondary_kit_slug: recommendation.secondaryKitSlug,
      score: recommendation.score,
      explanation: recommendation.explanation,
      required_categories: recommendation.requiredCategories,
      optional_categories: recommendation.optionalCategories,
      owned_items: recommendation.ownedItems,
      estimated_range_min_cents: recommendation.estimatedRange?.minCents ?? null,
      estimated_range_max_cents: recommendation.estimatedRange?.maxCents ?? null,
      risks: recommendation.risks,
      next_steps: recommendation.nextSteps,
      rule_version: recommendation.ruleVersion,
      // A fresh (re)calculation resets any prior override — the user must
      // re-confirm/override again against the new recommendation.
      user_selected_kit_slug: null,
      overridden: false,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(`Failed to save startup kit recommendation: ${error.message}`);
}

export async function overrideStartupKitSelection(
  tenantId: string,
  selectedKitSlug: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("startup_kit_recommendations")
    .select("recommended_kit_slug")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const overridden = existing ? isKitOverridden(existing.recommended_kit_slug, selectedKitSlug) : true;

  const { error } = await supabase
    .from("startup_kit_recommendations")
    .update({ user_selected_kit_slug: selectedKitSlug, overridden })
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`Failed to save kit selection: ${error.message}`);
}

// ---------------------------------------------------------------------------
// storefront_preferences
// ---------------------------------------------------------------------------
export type StorefrontPreferencesRow = {
  storefrontName: string | null;
  themeDirection: string | null;
  heroMessaging: string | null;
  featuredCategories: string[];
  domainStatus: "none" | "have_domain" | "need_domain" | null;
  existingDomain: string | null;
  contactChannel: string | null;
  announcementBarText: string | null;
  fulfillmentOffer: "pickup" | "shipping" | "both" | null;
  plannedPaymentMethods: Record<string, string>;
};

export async function getStorefrontPreferences(
  tenantId: string,
): Promise<StorefrontPreferencesRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("storefront_preferences")
    .select(
      "storefront_name, theme_direction, hero_messaging, featured_categories, domain_status, existing_domain, contact_channel, announcement_bar_text, fulfillment_offer, planned_payment_methods",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    storefrontName: data.storefront_name,
    themeDirection: data.theme_direction,
    heroMessaging: data.hero_messaging,
    featuredCategories: data.featured_categories,
    domainStatus: data.domain_status,
    existingDomain: data.existing_domain,
    contactChannel: data.contact_channel,
    announcementBarText: data.announcement_bar_text,
    fulfillmentOffer: data.fulfillment_offer,
    plannedPaymentMethods: (data.planned_payment_methods as Record<string, string>) ?? {},
  };
}

export async function saveStorefrontPreferences(
  tenantId: string,
  sessionId: string,
  input: StorefrontStepInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("storefront_preferences").upsert(
    {
      tenant_id: tenantId,
      session_id: sessionId,
      storefront_name: input.storefrontName || null,
      theme_direction: input.themeDirection || null,
      hero_messaging: input.heroMessaging || null,
      featured_categories: input.featuredCategories,
      domain_status: input.domainStatus ?? null,
      existing_domain: input.existingDomain || null,
      contact_channel: input.contactChannel || null,
      announcement_bar_text: input.announcementBarText || null,
      fulfillment_offer: input.fulfillmentOffer ?? null,
      planned_payment_methods: input.plannedPaymentMethods as Json,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(`Failed to save storefront preferences: ${error.message}`);
}

// ---------------------------------------------------------------------------
// fulfillment_preferences
// ---------------------------------------------------------------------------
export type FulfillmentPreferencesRow = {
  fulfillmentModel: string | null;
  productionLeadTimeDays: number | null;
  pickupLocationPlaceholder: string | null;
  shippingRegions: string[];
  returnPolicyStatus: "defined" | "in_progress" | "not_started" | null;
  packagingPreference: string | null;
  trackingRequired: boolean;
  qcResponsibility: string | null;
};

export async function getFulfillmentPreferences(
  tenantId: string,
): Promise<FulfillmentPreferencesRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("fulfillment_preferences")
    .select(
      "fulfillment_model, production_lead_time_days, pickup_location_placeholder, shipping_regions, return_policy_status, packaging_preference, tracking_required, qc_responsibility",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    fulfillmentModel: data.fulfillment_model,
    productionLeadTimeDays: data.production_lead_time_days,
    pickupLocationPlaceholder: data.pickup_location_placeholder,
    shippingRegions: data.shipping_regions,
    returnPolicyStatus: data.return_policy_status,
    packagingPreference: data.packaging_preference,
    trackingRequired: data.tracking_required,
    qcResponsibility: data.qc_responsibility,
  };
}

export async function saveFulfillmentPreferences(
  tenantId: string,
  sessionId: string,
  input: FulfillmentStepInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("fulfillment_preferences").upsert(
    {
      tenant_id: tenantId,
      session_id: sessionId,
      fulfillment_model: input.fulfillmentModel ?? null,
      production_lead_time_days: input.productionLeadTimeDays ?? null,
      pickup_location_placeholder: input.pickupLocationPlaceholder || null,
      shipping_regions: input.shippingRegions,
      return_policy_status: input.returnPolicyStatus ?? null,
      packaging_preference: input.packagingPreference || null,
      tracking_required: input.trackingRequired,
      qc_responsibility: input.qcResponsibility || null,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(`Failed to save fulfillment preferences: ${error.message}`);
}

// ---------------------------------------------------------------------------
// launch_readiness_assessments
// ---------------------------------------------------------------------------
export async function getLaunchReadinessAssessment(
  tenantId: string,
): Promise<LaunchReadinessResult | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("launch_readiness_assessments")
    .select("total_score, category_scores, strengths, gaps, priority_actions, blocking_issues, label")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    totalScore: data.total_score,
    categoryScores: data.category_scores as LaunchReadinessResult["categoryScores"],
    categoryMax: {
      brand_foundation: 15,
      audience_clarity: 10,
      product_strategy: 15,
      production_readiness: 20,
      budget_planning: 10,
      storefront_readiness: 10,
      fulfillment_readiness: 10,
      compliance_operational_planning: 10,
    },
    strengths: data.strengths,
    gaps: data.gaps,
    priorityActions: data.priority_actions,
    blockingIssues: data.blocking_issues,
    label: data.label as LaunchReadinessResult["label"],
  };
}

export async function saveLaunchReadinessAssessment(
  tenantId: string,
  sessionId: string,
  result: LaunchReadinessResult,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("launch_readiness_assessments").upsert(
    {
      tenant_id: tenantId,
      session_id: sessionId,
      total_score: result.totalScore,
      category_scores: result.categoryScores as Json,
      strengths: result.strengths,
      gaps: result.gaps,
      priority_actions: result.priorityActions,
      blocking_issues: result.blockingIssues,
      label: result.label,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(`Failed to save launch readiness assessment: ${error.message}`);
}
