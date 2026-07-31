import { describe, expect, it } from "vitest";
import { evaluateCondition, resolveFieldPath } from "../src/condition.js";
import type { ConditionNode } from "../src/policyDocument.js";

const context = {
  action: "payment.initiate",
  parameters: { amountUsd: 5000, currency: "USD" },
  targetResource: "invoice-1",
  riskLevel: "HIGH",
};

describe("resolveFieldPath", () => {
  it("resolves a top-level field", () => {
    expect(resolveFieldPath(context, "action")).toBe("payment.initiate");
  });

  it("resolves a nested dot-path", () => {
    expect(resolveFieldPath(context, "parameters.amountUsd")).toBe(5000);
  });

  it("returns undefined for an unresolvable path", () => {
    expect(
      resolveFieldPath(context, "parameters.missing.deeper"),
    ).toBeUndefined();
  });
});

describe("evaluateCondition — operators", () => {
  it.each([
    ["eq", "action", "payment.initiate", true],
    ["eq", "action", "data.export", false],
    ["neq", "action", "data.export", true],
    ["neq", "action", "payment.initiate", false],
    ["gt", "parameters.amountUsd", 100, true],
    ["gt", "parameters.amountUsd", 5000, false],
    ["gte", "parameters.amountUsd", 5000, true],
    ["lt", "parameters.amountUsd", 10000, true],
    ["lte", "parameters.amountUsd", 5000, true],
    ["in", "riskLevel", ["HIGH", "CRITICAL"], true],
    ["in", "riskLevel", ["LOW", "MEDIUM"], false],
    ["not_in", "riskLevel", ["LOW", "MEDIUM"], true],
    ["not_in", "riskLevel", ["HIGH"], false],
  ] as const)("%s %s %j -> %s", (operator, field, value, expected) => {
    const node: ConditionNode = { field, operator, value };
    expect(evaluateCondition(node, context)).toBe(expected);
  });

  it("an unresolvable field path fails eq/gt/lt-style operators", () => {
    const node: ConditionNode = {
      field: "parameters.missing",
      operator: "eq",
      value: 1,
    };
    expect(evaluateCondition(node, context)).toBe(false);
  });

  it("an unresolvable field path satisfies neq", () => {
    const node: ConditionNode = {
      field: "parameters.missing",
      operator: "neq",
      value: 1,
    };
    expect(evaluateCondition(node, context)).toBe(true);
  });
});

describe("evaluateCondition — all/any combinators", () => {
  it("all: true only when every child is true", () => {
    const node: ConditionNode = {
      all: [
        { field: "action", operator: "eq", value: "payment.initiate" },
        { field: "riskLevel", operator: "eq", value: "HIGH" },
      ],
    };
    expect(evaluateCondition(node, context)).toBe(true);
  });

  it("all: false when any child is false", () => {
    const node: ConditionNode = {
      all: [
        { field: "action", operator: "eq", value: "payment.initiate" },
        { field: "riskLevel", operator: "eq", value: "LOW" },
      ],
    };
    expect(evaluateCondition(node, context)).toBe(false);
  });

  it("any: true when at least one child is true", () => {
    const node: ConditionNode = {
      any: [
        { field: "riskLevel", operator: "eq", value: "LOW" },
        { field: "riskLevel", operator: "eq", value: "HIGH" },
      ],
    };
    expect(evaluateCondition(node, context)).toBe(true);
  });

  it("any: false when every child is false", () => {
    const node: ConditionNode = {
      any: [
        { field: "riskLevel", operator: "eq", value: "LOW" },
        { field: "riskLevel", operator: "eq", value: "MEDIUM" },
      ],
    };
    expect(evaluateCondition(node, context)).toBe(false);
  });

  it("nested all/any combinators evaluate recursively", () => {
    const node: ConditionNode = {
      all: [
        { field: "action", operator: "eq", value: "payment.initiate" },
        {
          any: [
            { field: "riskLevel", operator: "eq", value: "CRITICAL" },
            { field: "riskLevel", operator: "eq", value: "HIGH" },
          ],
        },
      ],
    };
    expect(evaluateCondition(node, context)).toBe(true);
  });

  it("an empty all[] is vacuously true; an empty any[] is vacuously false", () => {
    expect(evaluateCondition({ all: [] }, context)).toBe(true);
    expect(evaluateCondition({ any: [] }, context)).toBe(false);
  });
});
