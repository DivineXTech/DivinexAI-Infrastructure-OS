import { describe, expect, it } from "vitest";

import {
  audienceStepSchema,
  brandStepSchema,
  budgetStepSchema,
  fulfillmentStepSchema,
  productionStepSchema,
  productsStepSchema,
  startupKitOverrideSchema,
  storefrontStepSchema,
} from "@/lib/validation/onboarding";

describe("brandStepSchema", () => {
  it("requires a non-empty brand name", () => {
    expect(brandStepSchema.safeParse({ brandName: "" }).success).toBe(false);
    expect(brandStepSchema.safeParse({ brandName: "Kush Print Co" }).success).toBe(true);
  });

  it("accepts every optional field left blank", () => {
    const result = brandStepSchema.safeParse({ brandName: "Kush Print Co" });
    expect(result.success).toBe(true);
  });

  it("rejects a personality outside the closed enum", () => {
    const result = brandStepSchema.safeParse({
      brandName: "Kush Print Co",
      personality: "space_pirate",
    });
    expect(result.success).toBe(false);
  });
});

describe("audienceStepSchema", () => {
  it("requires at least one customer type", () => {
    expect(audienceStepSchema.safeParse({ customerTypes: [] }).success).toBe(false);
    expect(audienceStepSchema.safeParse({ customerTypes: ["schools"] }).success).toBe(true);
  });
});

describe("productsStepSchema", () => {
  const base = { categories: ["t_shirts"] };

  it("requires at least one category", () => {
    expect(productsStepSchema.safeParse({ categories: [] }).success).toBe(false);
  });

  it("accepts a target price range where min <= max", () => {
    const result = productsStepSchema.safeParse({
      ...base,
      targetPriceMinCents: 1000,
      targetPriceMaxCents: 3000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a target price range where min > max", () => {
    const result = productsStepSchema.safeParse({
      ...base,
      targetPriceMinCents: 3000,
      targetPriceMaxCents: 1000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["targetPriceMaxCents"]);
    }
  });

  it("allows only a minimum with no maximum set", () => {
    expect(productsStepSchema.safeParse({ ...base, targetPriceMinCents: 1000 }).success).toBe(true);
  });
});

describe("budgetStepSchema", () => {
  const base = { budgetBand: "1500_5000" as const };

  it("requires a budget band from the closed set", () => {
    expect(budgetStepSchema.safeParse({ budgetBand: "not_a_real_band" }).success).toBe(false);
    expect(budgetStepSchema.safeParse(base).success).toBe(true);
  });

  it("accepts allocations that sum to exactly the precise total", () => {
    const result = budgetStepSchema.safeParse({
      ...base,
      preciseTotalCents: 200_000,
      allocationEquipmentCents: 100_000,
      allocationBlankApparelCents: 100_000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects allocations that sum to more than the precise total", () => {
    const result = budgetStepSchema.safeParse({
      ...base,
      preciseTotalCents: 100_000,
      allocationEquipmentCents: 60_000,
      allocationBlankApparelCents: 60_000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["preciseTotalCents"]);
    }
  });

  it("allows allocations with no precise total set at all (nothing to violate)", () => {
    const result = budgetStepSchema.safeParse({
      ...base,
      allocationEquipmentCents: 1_000_000,
    });
    expect(result.success).toBe(true);
  });
});

describe("productionStepSchema", () => {
  it("defaults equipmentOwned to false when omitted", () => {
    const result = productionStepSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.equipmentOwned).toBe(false);
  });

  it("rejects a production method outside the closed enum", () => {
    expect(productionStepSchema.safeParse({ preferredMethod: "laser_engraving" }).success).toBe(false);
  });
});

describe("startupKitOverrideSchema", () => {
  it("requires a non-empty selected slug", () => {
    expect(startupKitOverrideSchema.safeParse({ selectedKitSlug: "" }).success).toBe(false);
    expect(startupKitOverrideSchema.safeParse({ selectedKitSlug: "dtf-launch-kit" }).success).toBe(true);
  });
});

describe("storefrontStepSchema", () => {
  it("accepts a planned payment methods record with valid statuses", () => {
    const result = storefrontStepSchema.safeParse({
      plannedPaymentMethods: { stripe: "connected", paypal: "planned" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid payment method status", () => {
    const result = storefrontStepSchema.safeParse({
      plannedPaymentMethods: { stripe: "sometimes" },
    });
    expect(result.success).toBe(false);
  });
});

describe("fulfillmentStepSchema", () => {
  it("defaults trackingRequired to false and shippingRegions to an empty array", () => {
    const result = fulfillmentStepSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.trackingRequired).toBe(false);
      expect(result.data.shippingRegions).toEqual([]);
    }
  });

  it("rejects a negative lead time", () => {
    expect(fulfillmentStepSchema.safeParse({ productionLeadTimeDays: -1 }).success).toBe(false);
  });
});
