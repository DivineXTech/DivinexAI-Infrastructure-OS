import { describe, expect, it } from "vitest";

import { checkProductActivation } from "@/lib/catalog/product-activation";

describe("checkProductActivation", () => {
  it("allows activation when name, production method, and a priced variant are all present", () => {
    const result = checkProductActivation({
      name: "Demo Tee",
      productionMethod: "dtf",
      variants: [{ retailPriceCents: 2500 }],
    });
    expect(result.canActivate).toBe(true);
    expect(result.missingRequirements).toEqual([]);
  });

  it("blocks activation with no variants", () => {
    const result = checkProductActivation({ name: "Demo Tee", productionMethod: "dtf", variants: [] });
    expect(result.canActivate).toBe(false);
    expect(result.missingRequirements.some((m) => /variant/i.test(m))).toBe(true);
  });

  it("blocks activation when every variant is missing a retail price", () => {
    const result = checkProductActivation({
      name: "Demo Tee",
      productionMethod: "dtf",
      variants: [{ retailPriceCents: null }, { retailPriceCents: null }],
    });
    expect(result.canActivate).toBe(false);
    expect(result.missingRequirements.some((m) => /retail price/i.test(m))).toBe(true);
  });

  it("allows activation when at least one variant (not necessarily all) has a retail price", () => {
    const result = checkProductActivation({
      name: "Demo Tee",
      productionMethod: "dtf",
      variants: [{ retailPriceCents: null }, { retailPriceCents: 1999 }],
    });
    expect(result.canActivate).toBe(true);
  });

  it("blocks activation with no production method selected", () => {
    const result = checkProductActivation({
      name: "Demo Tee",
      productionMethod: null,
      variants: [{ retailPriceCents: 1999 }],
    });
    expect(result.canActivate).toBe(false);
    expect(result.missingRequirements.some((m) => /production method/i.test(m))).toBe(true);
  });

  it("blocks activation with a blank name", () => {
    const result = checkProductActivation({ name: "   ", productionMethod: "dtf", variants: [{ retailPriceCents: 1999 }] });
    expect(result.canActivate).toBe(false);
  });

  it("reports every missing requirement at once, not just the first", () => {
    const result = checkProductActivation({ name: "", productionMethod: null, variants: [] });
    expect(result.missingRequirements.length).toBeGreaterThanOrEqual(3);
  });
});
