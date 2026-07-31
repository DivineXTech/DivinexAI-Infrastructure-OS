import { describe, expect, it } from "vitest";
import {
  assertSeparationOfDuties,
  SelfApprovalProhibitedError,
} from "../src/separationOfDuties.js";
import type { ActionSnapshot } from "../src/createApprovalRequest.js";

function baseSnapshot(overrides: Partial<ActionSnapshot> = {}): ActionSnapshot {
  return {
    action: "payment.initiate",
    parameters: {},
    targetResource: null,
    requestingActor: { type: "user", id: "user-requester" },
    requestingTenantAgentId: null,
    workflowRunId: "run-1",
    workflowStepId: "step-1",
    policyDecisionId: "decision-1",
    riskClassificationVersionId: "risk-1",
    evidence: {},
    traceContext: { traceId: "trace-1", correlationId: "corr-1" },
    proposedOutput: null,
    ...overrides,
  };
}

describe("assertSeparationOfDuties", () => {
  it("allows a decider who is neither the requesting actor nor the requesting tenant agent", () => {
    expect(() =>
      assertSeparationOfDuties(baseSnapshot(), {
        type: "user",
        id: "user-decider",
      }),
    ).not.toThrow();
  });

  it("prohibits the requesting user from deciding their own request", () => {
    expect(() =>
      assertSeparationOfDuties(baseSnapshot(), {
        type: "user",
        id: "user-requester",
      }),
    ).toThrow(SelfApprovalProhibitedError);
  });

  it("prohibits the requesting tenant agent from deciding, even under a different actor type label mismatch", () => {
    const snapshot = baseSnapshot({
      requestingActor: { type: "agent", id: "agent-1" },
      requestingTenantAgentId: "agent-1",
    });
    expect(() =>
      assertSeparationOfDuties(snapshot, { type: "agent", id: "agent-1" }),
    ).toThrow(SelfApprovalProhibitedError);
  });

  it("allows a user decider even when a (different) tenant agent originally requested it", () => {
    const snapshot = baseSnapshot({
      requestingActor: { type: "agent", id: "agent-1" },
      requestingTenantAgentId: "agent-1",
    });
    expect(() =>
      assertSeparationOfDuties(snapshot, { type: "user", id: "user-decider" }),
    ).not.toThrow();
  });

  it("does not prohibit a different user who merely shares the requester's id string under a different actor type", () => {
    const snapshot = baseSnapshot({
      requestingActor: { type: "system", id: "same-id" },
    });
    expect(() =>
      assertSeparationOfDuties(snapshot, { type: "user", id: "same-id" }),
    ).not.toThrow();
  });
});
