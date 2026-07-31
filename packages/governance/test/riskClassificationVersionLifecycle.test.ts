import { describe, expect, it } from "vitest";
import {
  RiskClassificationVersionStatusSchema,
  isValidRiskClassificationVersionTransition,
  assertValidRiskClassificationVersionTransition,
  InvalidRiskClassificationVersionTransitionError,
} from "../src/riskClassificationVersionLifecycle.js";

const ALL_STATUSES = RiskClassificationVersionStatusSchema.options;

describe("RiskClassificationVersionStatus transitions", () => {
  const validCases = [
    ["draft", "validated"],
    ["validated", "draft"],
    ["validated", "published"],
    ["published", "deprecated"],
    ["deprecated", "retired"],
  ] as const;

  it.each(validCases)("allows %s -> %s", (from, to) => {
    expect(isValidRiskClassificationVersionTransition(from, to)).toBe(true);
    expect(() =>
      assertValidRiskClassificationVersionTransition(from, to),
    ).not.toThrow();
  });

  const invalidCases = [
    ["draft", "published"],
    ["published", "draft"],
    ["retired", "draft"],
  ] as const;

  it.each(invalidCases)("rejects %s -> %s", (from, to) => {
    expect(isValidRiskClassificationVersionTransition(from, to)).toBe(false);
    expect(() =>
      assertValidRiskClassificationVersionTransition(from, to),
    ).toThrow(InvalidRiskClassificationVersionTransitionError);
  });

  it("retired is terminal", () => {
    for (const candidate of ALL_STATUSES) {
      expect(
        isValidRiskClassificationVersionTransition("retired", candidate),
      ).toBe(false);
    }
  });
});
