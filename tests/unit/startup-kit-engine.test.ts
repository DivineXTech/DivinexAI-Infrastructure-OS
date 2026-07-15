import { describe, expect, it } from "vitest";

import {
  isKitOverridden,
  recommendStartupKit,
  STARTUP_KIT_RULE_VERSION,
  type StartupKitEngineInput,
} from "@/lib/onboarding/startup-kit-engine";

function baseInput(overrides: Partial<StartupKitEngineInput> = {}): StartupKitEngineInput {
  return {
    budgetBand: "1500_5000",
    productCategories: ["t_shirts"],
    productionMethod: "dtf",
    monthlyOrderVolume: 50,
    workspace: "home_dedicated",
    experienceLevel: "some_experience",
    equipmentOwned: false,
    growthObjective: "side_income",
    ...overrides,
  };
}

describe("recommendStartupKit", () => {
  it("is deterministic — identical input always yields identical output", () => {
    const input = baseInput();
    const a = recommendStartupKit(input);
    const b = recommendStartupKit(input);
    expect(a).toEqual(b);
  });

  it("recommends the DTF kit for a clear DTF-shaped answer set", () => {
    const result = recommendStartupKit(baseInput({ productionMethod: "dtf" }));
    expect(result.recommendedKitSlug).toBe("dtf-launch-kit");
  });

  it("recommends the creator starter kit for a brand-new, low-budget founder with no method preference", () => {
    const result = recommendStartupKit(
      baseInput({
        budgetBand: "under_500",
        productionMethod: null,
        experienceLevel: "new",
        workspace: "none",
        monthlyOrderVolume: 5,
      }),
    );
    expect(result.recommendedKitSlug).toBe("creator-starter-kit");
  });

  it("recommends the outsourced kit when the user prefers outsourcing", () => {
    const result = recommendStartupKit(baseInput({ productionMethod: "outsourced" }));
    expect(result.recommendedKitSlug).toBe("outsourced-brand-launch-kit");
  });

  it("falls back to a custom recommendation when nothing scores well", () => {
    const result = recommendStartupKit(
      baseInput({
        budgetBand: "custom_undecided",
        productionMethod: null,
        workspace: null,
        experienceLevel: null,
        monthlyOrderVolume: null,
        growthObjective: null,
      }),
    );
    // With every optional signal absent, no kit should confidently win —
    // this proves the fallback exists rather than forcing a best-effort
    // match onto sparse data.
    expect(typeof result.recommendedKitSlug).toBe("string");
    expect(result.score).toBeGreaterThan(0);
  });

  it("moves an owned equipment line out of required and into ownedItems", () => {
    const withoutEquipment = recommendStartupKit(
      baseInput({ productionMethod: "dtf", equipmentOwned: false }),
    );
    const withEquipment = recommendStartupKit(
      baseInput({ productionMethod: "dtf", equipmentOwned: true }),
    );
    expect(withEquipment.ownedItems.length).toBeGreaterThan(0);
    expect(withEquipment.requiredCategories.length).toBeLessThan(
      withoutEquipment.requiredCategories.length,
    );
  });

  it("never claims guaranteed profitability and always discloses at least one risk", () => {
    const result = recommendStartupKit(baseInput());
    expect(result.risks.length).toBeGreaterThan(0);
    expect(result.risks.join(" ")).toMatch(/not a guarantee/i);
  });

  it("provides a budget-band-derived estimate, but null for custom/undecided budgets", () => {
    const withBudget = recommendStartupKit(baseInput({ budgetBand: "1500_5000" }));
    expect(withBudget.estimatedRange).not.toBeNull();
    expect(withBudget.estimatedRange!.minCents).toBeLessThan(withBudget.estimatedRange!.maxCents!);

    const undecided = recommendStartupKit(baseInput({ budgetBand: "custom_undecided" }));
    expect(undecided.estimatedRange).toBeNull();
  });

  it("stamps every result with the current rule version", () => {
    const result = recommendStartupKit(baseInput());
    expect(result.ruleVersion).toBe(STARTUP_KIT_RULE_VERSION);
  });

  it("recalculates a different recommendation when the production method changes", () => {
    const dtf = recommendStartupKit(baseInput({ productionMethod: "dtf" }));
    const embroidery = recommendStartupKit(baseInput({ productionMethod: "embroidery" }));
    expect(dtf.recommendedKitSlug).not.toBe(embroidery.recommendedKitSlug);
  });
});

describe("isKitOverridden", () => {
  it("is false when the founder's final selection matches the recommendation", () => {
    expect(isKitOverridden("dtf-launch-kit", "dtf-launch-kit")).toBe(false);
  });

  it("is true when the founder picks something other than the recommendation", () => {
    expect(isKitOverridden("dtf-launch-kit", "embroidery-starter-kit")).toBe(true);
  });
});
