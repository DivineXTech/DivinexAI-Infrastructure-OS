import { describe, expect, it } from "vitest";

import {
  calculateLaunchReadiness,
  type LaunchReadinessInput,
} from "@/lib/onboarding/launch-readiness-engine";

const EMPTY_INPUT: LaunchReadinessInput = {
  brand: null,
  audience: null,
  products: null,
  production: null,
  budget: null,
  storefront: null,
  fulfillment: null,
  compliance: null,
};

const COMPLETE_INPUT: LaunchReadinessInput = {
  brand: {
    hasBrandName: true,
    hasLogo: true,
    hasColors: true,
    hasPersonality: true,
    hasDescription: true,
  },
  audience: {
    hasCustomerTypes: true,
    hasAgeRanges: true,
    hasMarketType: true,
    hasStylePreferences: true,
  },
  products: {
    hasCategories: true,
    hasLaunchQuantity: true,
    hasDesignCount: true,
    hasPriceRange: true,
    hasSalesModel: true,
  },
  production: {
    hasPreferredMethod: true,
    hasExperienceLevel: true,
    hasWorkspace: true,
    hasVolumeEstimate: true,
    equipmentDecisionMade: true,
  },
  budget: { hasBudgetBand: true, hasAllocations: true },
  storefront: {
    hasStorefrontName: true,
    hasThemeDirection: true,
    hasDomainStatus: true,
    hasPaymentMethodPreferences: true,
  },
  fulfillment: {
    hasFulfillmentModel: true,
    hasLeadTime: true,
    hasReturnPolicyStatus: true,
    hasShippingRegions: true,
  },
  compliance: {
    returnPolicyDefined: true,
    qcResponsibilityAssigned: true,
    budgetPlanned: true,
  },
};

describe("calculateLaunchReadiness", () => {
  it("scores a fully completed onboarding as Launch Ready (>= 90)", () => {
    const result = calculateLaunchReadiness(COMPLETE_INPUT);
    expect(result.totalScore).toBe(100);
    expect(result.label).toBe("Launch Ready");
    expect(result.blockingIssues).toEqual([]);
  });

  it("scores completely empty onboarding as 0 / Foundation Needed, without throwing", () => {
    const result = calculateLaunchReadiness(EMPTY_INPUT);
    expect(result.totalScore).toBe(0);
    expect(result.label).toBe("Foundation Needed");
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });

  it("never exceeds 100 or goes below 0", () => {
    const result = calculateLaunchReadiness(COMPLETE_INPUT);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
  });

  it("category scores sum to the total score and each respects its own max", () => {
    const result = calculateLaunchReadiness(COMPLETE_INPUT);
    const sum = Object.values(result.categoryScores).reduce((a, b) => a + b, 0);
    expect(sum).toBe(result.totalScore);
    for (const key of Object.keys(result.categoryScores) as (keyof typeof result.categoryScores)[]) {
      expect(result.categoryScores[key]).toBeLessThanOrEqual(result.categoryMax[key]);
    }
  });

  it("flags missing brand name, production method, and budget band as blocking issues", () => {
    const result = calculateLaunchReadiness(EMPTY_INPUT);
    expect(result.blockingIssues.some((i) => /brand name/i.test(i))).toBe(true);
    expect(result.blockingIssues.some((i) => /production method/i.test(i))).toBe(true);
    expect(result.blockingIssues.some((i) => /budget/i.test(i))).toBe(true);
  });

  it("maps score bands to the correct labels", () => {
    expect(calculateLaunchReadiness(EMPTY_INPUT).label).toBe("Foundation Needed");

    const partial = calculateLaunchReadiness({
      ...EMPTY_INPUT,
      brand: {
        hasBrandName: true,
        hasLogo: true,
        hasColors: true,
        hasPersonality: true,
        hasDescription: true,
      },
      production: {
        hasPreferredMethod: true,
        hasExperienceLevel: true,
        hasWorkspace: true,
        hasVolumeEstimate: true,
        equipmentDecisionMade: true,
      },
      budget: { hasBudgetBand: true, hasAllocations: true },
    });
    // brand(15) + production(20) + budget(10) = 45 out of 100
    expect(partial.totalScore).toBe(45);
    expect(partial.label).toBe("Early Planning");
  });

  it("lists categories scoring below 50% as gaps and at/above 80% as strengths", () => {
    const result = calculateLaunchReadiness({
      ...EMPTY_INPUT,
      brand: {
        hasBrandName: true,
        hasLogo: true,
        hasColors: true,
        hasPersonality: true,
        hasDescription: true,
      },
    });
    expect(result.strengths).toContain("Brand foundation");
    expect(result.gaps).toContain("Audience clarity");
  });

  it("caps priority actions at 5", () => {
    const result = calculateLaunchReadiness(EMPTY_INPUT);
    expect(result.priorityActions.length).toBeLessThanOrEqual(5);
  });
});
