import { describe, expect, it } from "vitest";

import { normalizeTenantSlug, tenantSlugSchema } from "@/lib/validation/tenant";

describe("normalizeTenantSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(normalizeTenantSlug("My Cool Brand")).toBe("my-cool-brand");
  });

  it("strips non-alphanumeric characters", () => {
    expect(normalizeTenantSlug("Jane's Print Co.!!")).toBe("jane-s-print-co");
  });

  it("trims leading/trailing hyphens", () => {
    expect(normalizeTenantSlug("  --Streetwear--  ")).toBe("streetwear");
  });
});

describe("tenantSlugSchema", () => {
  it("accepts a well-formed slug", () => {
    expect(tenantSlugSchema.safeParse("streetwear-collective").success).toBe(true);
  });

  it("rejects reserved words", () => {
    for (const reserved of ["app", "admin", "api", "login", "store", "settings"]) {
      expect(tenantSlugSchema.safeParse(reserved).success).toBe(false);
    }
  });

  it("rejects slugs shorter than 3 characters", () => {
    expect(tenantSlugSchema.safeParse("ab").success).toBe(false);
  });

  it("rejects uppercase or invalid characters", () => {
    expect(tenantSlugSchema.safeParse("MyBrand").success).toBe(false);
    expect(tenantSlugSchema.safeParse("my_brand").success).toBe(false);
    expect(tenantSlugSchema.safeParse("-my-brand").success).toBe(false);
  });
});
