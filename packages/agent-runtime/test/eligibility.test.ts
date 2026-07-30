import { describe, expect, it } from "vitest";
import {
  assertAgentEligible,
  AgentNotEligibleError,
} from "../src/eligibility.js";
import type { TenantAgentInstallation } from "../src/tenantAgentRegistry.js";
import type { TenantAgentLifecycleStatus } from "../src/tenantAgentLifecycle.js";

function installation(
  overrides: Partial<TenantAgentInstallation> = {},
): TenantAgentInstallation {
  return {
    id: "installation-1",
    tenantId: "tenant-1",
    agentDefinitionId: "def-1",
    agentVersionId: "version-1",
    displayNameOverride: null,
    lifecycleStatus: "MOCK_EXECUTABLE",
    enabled: true,
    configuration: {},
    executionPolicy: {},
    approvalPolicy: {},
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("assertAgentEligible", () => {
  it("does not throw for an enabled, MOCK_EXECUTABLE installation", () => {
    expect(() => assertAgentEligible(installation())).not.toThrow();
  });

  it("does not throw for an enabled, ACTIVE installation", () => {
    expect(() =>
      assertAgentEligible(installation({ lifecycleStatus: "ACTIVE" })),
    ).not.toThrow();
  });

  it("throws when the installation is not enabled", () => {
    expect(() => assertAgentEligible(installation({ enabled: false }))).toThrow(
      AgentNotEligibleError,
    );
  });

  it("throws for a REGISTERED (not yet MOCK_EXECUTABLE) installation", () => {
    expect(() =>
      assertAgentEligible(installation({ lifecycleStatus: "REGISTERED" })),
    ).toThrow(AgentNotEligibleError);
  });

  it("throws for a SUSPENDED installation regardless of enabled flag", () => {
    expect(() =>
      assertAgentEligible(
        installation({ lifecycleStatus: "SUSPENDED", enabled: true }),
      ),
    ).toThrow(AgentNotEligibleError);
  });

  it.each<TenantAgentLifecycleStatus>([
    "MOCK_EXECUTABLE",
    "EVALUATION_TESTED",
    "TOOL_ENABLED",
    "APPROVAL_GOVERNED",
    "ACTIVE",
  ])("does not throw for lifecycle status %s when enabled", (status) => {
    expect(() =>
      assertAgentEligible(installation({ lifecycleStatus: status })),
    ).not.toThrow();
  });
});
