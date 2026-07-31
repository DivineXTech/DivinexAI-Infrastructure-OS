import { describe, expect, it } from "vitest";
import {
  computePolicyHash,
  computeRiskClassificationHash,
  computeActionPayloadHash,
} from "../src/contentHash.js";
import type { PolicyDocument } from "../src/policyDocument.js";

function baseDocument(): PolicyDocument {
  return {
    appliesToActions: ["data.export"],
    conditions: { field: "action", operator: "eq", value: "data.export" },
    effect: "REQUIRE_APPROVAL",
    riskLevel: "MEDIUM",
    requiredPermissions: [],
    requiredApproverRoles: [],
    requiredApprovalCount: 1,
    rejectOnFirstRejection: true,
    approvalExpirationMs: null,
  };
}

describe("computePolicyHash", () => {
  it("is deterministic for identical content", () => {
    expect(computePolicyHash(baseDocument())).toBe(computePolicyHash(baseDocument()));
  });

  it("is insensitive to key order at every depth (mirrors platform-kernel's canonicalization)", () => {
    const a = baseDocument();
    const b: PolicyDocument = {
      requiredApprovalCount: a.requiredApprovalCount,
      appliesToActions: a.appliesToActions,
      effect: a.effect,
      conditions: { value: "data.export", field: "action", operator: "eq" },
      riskLevel: a.riskLevel,
      requiredPermissions: a.requiredPermissions,
      requiredApproverRoles: a.requiredApproverRoles,
      rejectOnFirstRejection: a.rejectOnFirstRejection,
      approvalExpirationMs: a.approvalExpirationMs,
    };
    expect(computePolicyHash(b)).toBe(computePolicyHash(a));
  });

  it("changes when the document's content changes", () => {
    const changed: PolicyDocument = { ...baseDocument(), effect: "BLOCK" };
    expect(computePolicyHash(changed)).not.toBe(computePolicyHash(baseDocument()));
  });
});

describe("computeRiskClassificationHash", () => {
  it("is deterministic and changes with content", () => {
    const base = { action: "data.export", riskLevel: "HIGH" as const, rationale: "exports leave the tenant boundary" };
    expect(computeRiskClassificationHash(base)).toBe(computeRiskClassificationHash({ ...base }));
    expect(computeRiskClassificationHash({ ...base, riskLevel: "CRITICAL" })).not.toBe(
      computeRiskClassificationHash(base),
    );
  });
});

describe("computeActionPayloadHash", () => {
  it("hashes only action/parameters/targetResource — unaffected by other fields the caller might pass alongside it elsewhere", () => {
    const a = computeActionPayloadHash({
      action: "payment.initiate",
      parameters: { amountUsd: 100 },
      targetResource: "invoice-1",
    });
    const b = computeActionPayloadHash({
      action: "payment.initiate",
      parameters: { amountUsd: 100 },
      targetResource: "invoice-1",
    });
    expect(a).toBe(b);
  });

  it("changes when parameters change (detects drift)", () => {
    const a = computeActionPayloadHash({
      action: "payment.initiate",
      parameters: { amountUsd: 100 },
      targetResource: "invoice-1",
    });
    const b = computeActionPayloadHash({
      action: "payment.initiate",
      parameters: { amountUsd: 200 },
      targetResource: "invoice-1",
    });
    expect(a).not.toBe(b);
  });
});
