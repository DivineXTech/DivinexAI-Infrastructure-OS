/**
 * Transparent, deterministic launch-readiness scoring. Pure function — no
 * I/O — so it's unit-testable and can be recalculated on every review-page
 * load without a stored, possibly-stale score. See
 * docs/LAUNCH_READINESS.md for full category rationale.
 *
 * This is an operational-planning score, not a prediction of business
 * success — every result should be presented with that framing intact.
 */

export type LaunchReadinessInput = {
  brand: {
    hasBrandName: boolean;
    hasLogo: boolean;
    hasColors: boolean;
    hasPersonality: boolean;
    hasDescription: boolean;
  } | null;
  audience: {
    hasCustomerTypes: boolean;
    hasAgeRanges: boolean;
    hasMarketType: boolean;
    hasStylePreferences: boolean;
  } | null;
  products: {
    hasCategories: boolean;
    hasLaunchQuantity: boolean;
    hasDesignCount: boolean;
    hasPriceRange: boolean;
    hasSalesModel: boolean;
  } | null;
  production: {
    hasPreferredMethod: boolean;
    hasExperienceLevel: boolean;
    hasWorkspace: boolean;
    hasVolumeEstimate: boolean;
    equipmentDecisionMade: boolean;
  } | null;
  budget: {
    hasBudgetBand: boolean;
    hasAllocations: boolean;
  } | null;
  storefront: {
    hasStorefrontName: boolean;
    hasThemeDirection: boolean;
    hasDomainStatus: boolean;
    hasPaymentMethodPreferences: boolean;
  } | null;
  fulfillment: {
    hasFulfillmentModel: boolean;
    hasLeadTime: boolean;
    hasReturnPolicyStatus: boolean;
    hasShippingRegions: boolean;
  } | null;
  compliance: {
    returnPolicyDefined: boolean;
    qcResponsibilityAssigned: boolean;
    budgetPlanned: boolean;
  } | null;
};

export type ReadinessLabel =
  | "Foundation Needed"
  | "Early Planning"
  | "Building"
  | "Launch Preparation"
  | "Launch Ready";

export type CategoryKey =
  | "brand_foundation"
  | "audience_clarity"
  | "product_strategy"
  | "production_readiness"
  | "budget_planning"
  | "storefront_readiness"
  | "fulfillment_readiness"
  | "compliance_operational_planning";

export type LaunchReadinessResult = {
  totalScore: number;
  categoryScores: Record<CategoryKey, number>;
  categoryMax: Record<CategoryKey, number>;
  label: ReadinessLabel;
  strengths: string[];
  gaps: string[];
  priorityActions: string[];
  blockingIssues: string[];
};

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  brand_foundation: "Brand foundation",
  audience_clarity: "Audience clarity",
  product_strategy: "Product strategy",
  production_readiness: "Production readiness",
  budget_planning: "Budget planning",
  storefront_readiness: "Storefront readiness",
  fulfillment_readiness: "Fulfillment readiness",
  compliance_operational_planning: "Compliance and operational planning",
};

const CATEGORY_MAX: Record<CategoryKey, number> = {
  brand_foundation: 15,
  audience_clarity: 10,
  product_strategy: 15,
  production_readiness: 20,
  budget_planning: 10,
  storefront_readiness: 10,
  fulfillment_readiness: 10,
  compliance_operational_planning: 10,
};

/** Score = max * (checks passed / total checks), rounded. Missing section
 * (null) scores 0 for that category rather than throwing — the engine
 * must be resilient to being called before every step is complete. */
function scoreChecks(max: number, checks: (boolean | undefined)[]): number {
  if (checks.length === 0) return 0;
  const passed = checks.filter(Boolean).length;
  return Math.round(max * (passed / checks.length));
}

function labelFor(totalScore: number): ReadinessLabel {
  if (totalScore >= 90) return "Launch Ready";
  if (totalScore >= 75) return "Launch Preparation";
  if (totalScore >= 60) return "Building";
  if (totalScore >= 40) return "Early Planning";
  return "Foundation Needed";
}

export function calculateLaunchReadiness(
  input: LaunchReadinessInput,
): LaunchReadinessResult {
  const categoryScores: Record<CategoryKey, number> = {
    brand_foundation: scoreChecks(CATEGORY_MAX.brand_foundation, [
      input.brand?.hasBrandName,
      input.brand?.hasLogo,
      input.brand?.hasColors,
      input.brand?.hasPersonality,
      input.brand?.hasDescription,
    ]),
    audience_clarity: scoreChecks(CATEGORY_MAX.audience_clarity, [
      input.audience?.hasCustomerTypes,
      input.audience?.hasAgeRanges,
      input.audience?.hasMarketType,
      input.audience?.hasStylePreferences,
    ]),
    product_strategy: scoreChecks(CATEGORY_MAX.product_strategy, [
      input.products?.hasCategories,
      input.products?.hasLaunchQuantity,
      input.products?.hasDesignCount,
      input.products?.hasPriceRange,
      input.products?.hasSalesModel,
    ]),
    production_readiness: scoreChecks(CATEGORY_MAX.production_readiness, [
      input.production?.hasPreferredMethod,
      input.production?.hasExperienceLevel,
      input.production?.hasWorkspace,
      input.production?.hasVolumeEstimate,
      input.production?.equipmentDecisionMade,
    ]),
    budget_planning: scoreChecks(CATEGORY_MAX.budget_planning, [
      input.budget?.hasBudgetBand,
      input.budget?.hasAllocations,
    ]),
    storefront_readiness: scoreChecks(CATEGORY_MAX.storefront_readiness, [
      input.storefront?.hasStorefrontName,
      input.storefront?.hasThemeDirection,
      input.storefront?.hasDomainStatus,
      input.storefront?.hasPaymentMethodPreferences,
    ]),
    fulfillment_readiness: scoreChecks(CATEGORY_MAX.fulfillment_readiness, [
      input.fulfillment?.hasFulfillmentModel,
      input.fulfillment?.hasLeadTime,
      input.fulfillment?.hasReturnPolicyStatus,
      input.fulfillment?.hasShippingRegions,
    ]),
    compliance_operational_planning: scoreChecks(
      CATEGORY_MAX.compliance_operational_planning,
      [
        input.compliance?.returnPolicyDefined,
        input.compliance?.qcResponsibilityAssigned,
        input.compliance?.budgetPlanned,
      ],
    ),
  };

  const totalScore = Math.min(
    100,
    Object.values(categoryScores).reduce((sum, s) => sum + s, 0),
  );

  const strengths: string[] = [];
  const gaps: string[] = [];
  const priorityActions: string[] = [];

  for (const key of Object.keys(categoryScores) as CategoryKey[]) {
    const max = CATEGORY_MAX[key];
    const score = categoryScores[key];
    const ratio = score / max;
    if (ratio >= 0.8) {
      strengths.push(CATEGORY_LABEL[key]);
    } else if (ratio < 0.5) {
      gaps.push(CATEGORY_LABEL[key]);
      priorityActions.push(`Complete the ${CATEGORY_LABEL[key].toLowerCase()} step.`);
    }
  }

  const blockingIssues: string[] = [];
  if (!input.brand?.hasBrandName) {
    blockingIssues.push("A brand name is required before launch.");
  }
  if (!input.production?.hasPreferredMethod) {
    blockingIssues.push("No production method has been selected.");
  }
  if (!input.budget?.hasBudgetBand) {
    blockingIssues.push("No budget band has been selected.");
  }

  return {
    totalScore,
    categoryScores,
    categoryMax: CATEGORY_MAX,
    label: labelFor(totalScore),
    strengths,
    gaps,
    priorityActions: priorityActions.slice(0, 5),
    blockingIssues,
  };
}
