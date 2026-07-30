import { describe, expect, it } from "vitest";
import {
  AgentVersionStatusSchema,
  isValidAgentVersionTransition,
  assertValidAgentVersionTransition,
  InvalidAgentVersionTransitionError,
} from "../src/agentVersionLifecycle.js";

const ALL = AgentVersionStatusSchema.options;

describe("AgentVersionStatusSchema", () => {
  it("accepts exactly the five platform lifecycle states", () => {
    expect(ALL).toEqual([
      "draft",
      "validated",
      "published",
      "deprecated",
      "retired",
    ]);
  });
});

describe("agent version transitions", () => {
  it("allows the forward path draft -> validated -> published -> deprecated -> retired", () => {
    expect(isValidAgentVersionTransition("draft", "validated")).toBe(true);
    expect(isValidAgentVersionTransition("validated", "published")).toBe(true);
    expect(isValidAgentVersionTransition("published", "deprecated")).toBe(true);
    expect(isValidAgentVersionTransition("deprecated", "retired")).toBe(true);
  });

  it("allows validated -> draft (rework before publishing)", () => {
    expect(isValidAgentVersionTransition("validated", "draft")).toBe(true);
  });

  it("rejects skipping straight from draft to published", () => {
    expect(isValidAgentVersionTransition("draft", "published")).toBe(false);
  });

  it("rejects any transition out of published back to draft or validated (immutability)", () => {
    expect(isValidAgentVersionTransition("published", "draft")).toBe(false);
    expect(isValidAgentVersionTransition("published", "validated")).toBe(false);
  });

  it("retired is terminal", () => {
    for (const candidate of ALL) {
      expect(isValidAgentVersionTransition("retired", candidate)).toBe(false);
    }
  });

  it("assertValidAgentVersionTransition throws InvalidAgentVersionTransitionError on an invalid move", () => {
    expect(() => assertValidAgentVersionTransition("draft", "retired")).toThrow(
      InvalidAgentVersionTransitionError,
    );
  });

  it("assertValidAgentVersionTransition does not throw on a valid move", () => {
    expect(() =>
      assertValidAgentVersionTransition("draft", "validated"),
    ).not.toThrow();
  });
});
