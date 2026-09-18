import { describe, expect, it } from "vitest";

import { APP_NAV, filterNavByRole } from "@/lib/navigation";

describe("filterNavByRole", () => {
  it("hides admin-only items from a non-admin role", () => {
    const result = filterNavByRole(APP_NAV, "designer");
    expect(result.some((item) => item.href === "/app/billing")).toBe(false);
    expect(result.some((item) => item.href === "/app/team")).toBe(false);
    expect(result.some((item) => item.href === "/app/settings")).toBe(false);
  });

  it("shows admin-only items to a tenant owner", () => {
    const result = filterNavByRole(APP_NAV, "tenant_owner");
    expect(result.some((item) => item.href === "/app/billing")).toBe(true);
    expect(result.some((item) => item.href === "/app/team")).toBe(true);
    expect(result.some((item) => item.href === "/app/settings")).toBe(true);
  });

  it("shows unrestricted items to every role", () => {
    const result = filterNavByRole(APP_NAV, "customer");
    expect(result.some((item) => item.href === "/app")).toBe(true);
    expect(result.some((item) => item.href === "/app/orders")).toBe(true);
  });
});
