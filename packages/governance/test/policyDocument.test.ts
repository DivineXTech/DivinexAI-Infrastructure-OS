import { describe, expect, it } from "vitest";
import {
  PolicyDocumentSchema,
  PolicyOverrideDocumentSchema,
  EFFECT_PRECEDENCE,
  effectPrecedenceIndex,
  mostRestrictiveEffect,
  RISK_LEVELS,
  riskLevelRank,
  maxRiskLevel,
} from "../src/policyDocument.js";

function baseDocument() {
  return {
    appliesToActions: ["communication.send.external"],
    conditions: {
      field: "action",
      operator: "eq" as const,
      value: "communication.send.external",
    },
    effect: "REQUIRE_APPROVAL" as const,
    riskLevel: "MEDIUM" as const,
    requiredPermissions: [],
    requiredApproverRoles: [],
    requiredApprovalCount: 1,
    rejectOnFirstRejection: true,
    approvalExpirationMs: null,
  };
}

describe("PolicyDocumentSchema", () => {
  it("accepts a valid document", () => {
    expect(() => PolicyDocumentSchema.parse(baseDocument())).not.toThrow();
  });

  it("accepts appliesToActions containing the wildcard", () => {
    expect(() =>
      PolicyDocumentSchema.parse({
        ...baseDocument(),
        appliesToActions: ["*"],
      }),
    ).not.toThrow();
  });

  it("rejects an unknown governed action", () => {
    expect(() =>
      PolicyDocumentSchema.parse({
        ...baseDocument(),
        appliesToActions: ["not.a.real.action"],
      }),
    ).toThrow();
  });

  it("rejects an empty appliesToActions array", () => {
    expect(() =>
      PolicyDocumentSchema.parse({ ...baseDocument(), appliesToActions: [] }),
    ).toThrow();
  });

  it("rejects an unknown effect", () => {
    expect(() =>
      PolicyDocumentSchema.parse({ ...baseDocument(), effect: "MAYBE" }),
    ).toThrow();
  });

  it("accepts a nested all/any condition tree", () => {
    const document = {
      ...baseDocument(),
      conditions: {
        all: [
          { field: "action", operator: "eq" as const, value: "data.export" },
          {
            any: [
              { field: "riskLevel", operator: "eq" as const, value: "HIGH" },
              {
                field: "riskLevel",
                operator: "eq" as const,
                value: "CRITICAL",
              },
            ],
          },
        ],
      },
    };
    expect(() => PolicyDocumentSchema.parse(document)).not.toThrow();
  });

  it("rejects a non-positive requiredApprovalCount", () => {
    expect(() =>
      PolicyDocumentSchema.parse({
        ...baseDocument(),
        requiredApprovalCount: 0,
      }),
    ).toThrow();
  });

  it("defaults rejectOnFirstRejection to true when omitted", () => {
    const document = baseDocument() as Record<string, unknown>;
    delete document.rejectOnFirstRejection;
    const parsed = PolicyDocumentSchema.parse(document);
    expect(parsed.rejectOnFirstRejection).toBe(true);
  });
});

describe("PolicyOverrideDocumentSchema", () => {
  it("has no field capable of loosening effect, lowering approval count, or removing a requirement", () => {
    const parsed = PolicyOverrideDocumentSchema.parse({});
    expect(parsed).not.toHaveProperty("effect");
    expect(parsed).toEqual({
      additionalRequiredApprovalCount: 0,
      additionalRequiredApproverRoles: [],
      additionalRequiredPermissions: [],
      tightenedConditions: null,
    });
  });

  it("accepts additive fields", () => {
    const parsed = PolicyOverrideDocumentSchema.parse({
      additionalRequiredApprovalCount: 1,
      additionalRequiredApproverRoles: ["security-lead"],
      additionalRequiredPermissions: ["tenant.manage"],
      tightenedConditions: {
        field: "riskLevel",
        operator: "eq",
        value: "CRITICAL",
      },
    });
    expect(parsed.additionalRequiredApprovalCount).toBe(1);
  });

  it("rejects a negative additionalRequiredApprovalCount (cannot express a reduction)", () => {
    expect(() =>
      PolicyOverrideDocumentSchema.parse({
        additionalRequiredApprovalCount: -1,
      }),
    ).toThrow();
  });
});

describe("EFFECT_PRECEDENCE", () => {
  it("is BLOCK > DENY > ESCALATE > REQUIRE_APPROVAL > ALLOW", () => {
    expect(EFFECT_PRECEDENCE).toEqual([
      "BLOCK",
      "DENY",
      "ESCALATE",
      "REQUIRE_APPROVAL",
      "ALLOW",
    ]);
  });

  it("effectPrecedenceIndex(BLOCK) is the lowest (most restrictive)", () => {
    expect(effectPrecedenceIndex("BLOCK")).toBe(0);
    expect(effectPrecedenceIndex("ALLOW")).toBe(4);
  });

  it.each([
    ["BLOCK", "ALLOW", "BLOCK"],
    ["ALLOW", "BLOCK", "BLOCK"],
    ["DENY", "ESCALATE", "DENY"],
    ["DENY", "REQUIRE_APPROVAL", "DENY"],
    ["DENY", "ALLOW", "DENY"],
    ["ESCALATE", "REQUIRE_APPROVAL", "ESCALATE"],
    ["ESCALATE", "ALLOW", "ESCALATE"],
    ["REQUIRE_APPROVAL", "ALLOW", "REQUIRE_APPROVAL"],
    ["ALLOW", "ALLOW", "ALLOW"],
    ["BLOCK", "DENY", "BLOCK"],
  ] as const)("mostRestrictiveEffect(%s, %s) -> %s", (a, b, expected) => {
    expect(mostRestrictiveEffect(a, b)).toBe(expected);
  });
});

describe("risk level ranking", () => {
  it("is LOW < MEDIUM < HIGH < CRITICAL", () => {
    expect(RISK_LEVELS).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  });

  it.each([
    ["LOW", "CRITICAL", "CRITICAL"],
    ["HIGH", "MEDIUM", "HIGH"],
    ["LOW", "LOW", "LOW"],
  ] as const)("maxRiskLevel(%s, %s) -> %s", (a, b, expected) => {
    expect(maxRiskLevel(a, b)).toBe(expected);
  });

  it("riskLevelRank is monotonically increasing", () => {
    expect(riskLevelRank("LOW")).toBeLessThan(riskLevelRank("MEDIUM"));
    expect(riskLevelRank("MEDIUM")).toBeLessThan(riskLevelRank("HIGH"));
    expect(riskLevelRank("HIGH")).toBeLessThan(riskLevelRank("CRITICAL"));
  });
});
