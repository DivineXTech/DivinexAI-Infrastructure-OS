import { describe, expect, it } from "vitest";
import {
  PolicyVersionStatusSchema,
  isValidPolicyVersionTransition,
  assertValidPolicyVersionTransition,
  InvalidPolicyVersionTransitionError,
} from "../src/policyVersionLifecycle.js";

const ALL_STATUSES = PolicyVersionStatusSchema.options;

describe("PolicyVersionStatus transitions", () => {
  const validCases = [
    ["draft", "validated"],
    ["validated", "draft"],
    ["validated", "published"],
    ["published", "deprecated"],
    ["deprecated", "retired"],
  ] as const;

  it.each(validCases)("allows %s -> %s", (from, to) => {
    expect(isValidPolicyVersionTransition(from, to)).toBe(true);
    expect(() => assertValidPolicyVersionTransition(from, to)).not.toThrow();
  });

  const invalidCases = [
    ["draft", "published"],
    ["published", "draft"],
    ["retired", "draft"],
    ["retired", "published"],
  ] as const;

  it.each(invalidCases)("rejects %s -> %s", (from, to) => {
    expect(isValidPolicyVersionTransition(from, to)).toBe(false);
    expect(() => assertValidPolicyVersionTransition(from, to)).toThrow(
      InvalidPolicyVersionTransitionError,
    );
  });

  it("retired is terminal", () => {
    for (const candidate of ALL_STATUSES) {
      expect(isValidPolicyVersionTransition("retired", candidate)).toBe(false);
    }
  });
});
