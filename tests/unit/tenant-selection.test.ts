import { describe, expect, it } from "vitest";

import {
  resolveCurrentTenantMembership,
  type TenantMembership,
} from "@/lib/auth/tenant-selection";

function membership(overrides: Partial<TenantMembership>): TenantMembership {
  return {
    tenantId: "tenant-1",
    tenantSlug: "tenant-one",
    tenantName: "Tenant One",
    roleKey: "designer",
    status: "active",
    ...overrides,
  };
}

describe("resolveCurrentTenantMembership", () => {
  it("returns null deterministically for an empty list (revoked/no membership), never throws", () => {
    expect(resolveCurrentTenantMembership([], "anything")).toBeNull();
    expect(resolveCurrentTenantMembership([], undefined)).toBeNull();
  });

  it("picks the membership matching the preferred slug", () => {
    const a = membership({ tenantId: "a", tenantSlug: "brand-a" });
    const b = membership({ tenantId: "b", tenantSlug: "brand-b" });
    expect(resolveCurrentTenantMembership([a, b], "brand-b")).toEqual(b);
  });

  it("falls back to the first membership when the preferred slug is unset", () => {
    const a = membership({ tenantId: "a", tenantSlug: "brand-a" });
    const b = membership({ tenantId: "b", tenantSlug: "brand-b" });
    expect(resolveCurrentTenantMembership([a, b], undefined)).toEqual(a);
  });

  it("falls back to the first membership when the preferred slug matches none (stale cookie)", () => {
    const a = membership({ tenantId: "a", tenantSlug: "brand-a" });
    expect(resolveCurrentTenantMembership([a], "some-other-tenant")).toEqual(a);
  });

  it("preserves multi-tenant switching: a two-tenant caller resolves either tenant by slug", () => {
    const a = membership({ tenantId: "a", tenantSlug: "brand-a", roleKey: "tenant_owner" });
    const b = membership({ tenantId: "b", tenantSlug: "brand-b", roleKey: "designer" });
    expect(resolveCurrentTenantMembership([a, b], "brand-a")?.roleKey).toBe("tenant_owner");
    expect(resolveCurrentTenantMembership([a, b], "brand-b")?.roleKey).toBe("designer");
  });
});
