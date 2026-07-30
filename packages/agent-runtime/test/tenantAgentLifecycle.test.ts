import { describe, expect, it } from "vitest";
import {
  TenantAgentLifecycleStatusSchema,
  isValidTenantAgentTransition,
  assertValidTenantAgentTransition,
  InvalidTenantAgentTransitionError,
  type TenantAgentLifecycleStatus,
} from "../src/tenantAgentLifecycle.js";

const ALL = TenantAgentLifecycleStatusSchema.options;

describe("TenantAgentLifecycleStatusSchema", () => {
  it("accepts exactly the seven tenant runtime states (no DEFINED)", () => {
    expect(ALL).toEqual([
      "REGISTERED",
      "MOCK_EXECUTABLE",
      "EVALUATION_TESTED",
      "TOOL_ENABLED",
      "APPROVAL_GOVERNED",
      "ACTIVE",
      "SUSPENDED",
    ]);
  });

  it("rejects DEFINED — that is a platform-version state, not a tenant runtime state", () => {
    expect(() => TenantAgentLifecycleStatusSchema.parse("DEFINED")).toThrow();
  });
});

describe("ACTIVE is reachable only via the full ordered sequence", () => {
  const sequence: TenantAgentLifecycleStatus[] = [
    "REGISTERED",
    "MOCK_EXECUTABLE",
    "EVALUATION_TESTED",
    "TOOL_ENABLED",
    "APPROVAL_GOVERNED",
    "ACTIVE",
  ];

  it("each consecutive step in the sequence is a valid transition", () => {
    for (let i = 0; i < sequence.length - 1; i++) {
      expect(isValidTenantAgentTransition(sequence[i]!, sequence[i + 1]!)).toBe(
        true,
      );
    }
  });

  it("no state may skip directly to ACTIVE except APPROVAL_GOVERNED (first activation) or SUSPENDED (resume)", () => {
    for (const status of ALL) {
      if (status === "APPROVAL_GOVERNED" || status === "SUSPENDED") continue;
      expect(isValidTenantAgentTransition(status, "ACTIVE")).toBe(false);
    }
  });

  it("REGISTERED (freshly installed, per default) cannot jump straight to ACTIVE", () => {
    expect(isValidTenantAgentTransition("REGISTERED", "ACTIVE")).toBe(false);
  });
});

describe("SUSPENDED", () => {
  it("is reachable from every state after REGISTERED", () => {
    for (const status of ALL) {
      if (status === "REGISTERED" || status === "SUSPENDED") continue;
      expect(isValidTenantAgentTransition(status, "SUSPENDED")).toBe(true);
    }
  });

  it("is not reachable directly from REGISTERED", () => {
    expect(isValidTenantAgentTransition("REGISTERED", "SUSPENDED")).toBe(false);
  });

  it("resumes only to ACTIVE, not back to an earlier stage", () => {
    expect(isValidTenantAgentTransition("SUSPENDED", "ACTIVE")).toBe(true);
    expect(isValidTenantAgentTransition("SUSPENDED", "REGISTERED")).toBe(false);
    expect(isValidTenantAgentTransition("SUSPENDED", "MOCK_EXECUTABLE")).toBe(
      false,
    );
  });
});

describe("assertValidTenantAgentTransition", () => {
  it("throws InvalidTenantAgentTransitionError on an invalid move", () => {
    expect(() =>
      assertValidTenantAgentTransition("REGISTERED", "ACTIVE"),
    ).toThrow(InvalidTenantAgentTransitionError);
  });

  it("does not throw on a valid move", () => {
    expect(() =>
      assertValidTenantAgentTransition("REGISTERED", "MOCK_EXECUTABLE"),
    ).not.toThrow();
  });
});
