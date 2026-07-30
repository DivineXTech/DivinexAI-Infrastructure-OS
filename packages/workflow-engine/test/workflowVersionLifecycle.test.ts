import { describe, expect, it } from "vitest";
import {
  WorkflowVersionStatusSchema,
  isValidWorkflowVersionTransition,
  assertValidWorkflowVersionTransition,
  InvalidWorkflowVersionTransitionError,
} from "../src/workflowVersionLifecycle.js";

const ALL = WorkflowVersionStatusSchema.options;

describe("WorkflowVersionStatusSchema", () => {
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

describe("workflow version transitions", () => {
  it("allows the forward path draft -> validated -> published -> deprecated -> retired", () => {
    expect(isValidWorkflowVersionTransition("draft", "validated")).toBe(true);
    expect(isValidWorkflowVersionTransition("validated", "published")).toBe(
      true,
    );
    expect(isValidWorkflowVersionTransition("published", "deprecated")).toBe(
      true,
    );
    expect(isValidWorkflowVersionTransition("deprecated", "retired")).toBe(
      true,
    );
  });

  it("allows validated -> draft (rework before publishing)", () => {
    expect(isValidWorkflowVersionTransition("validated", "draft")).toBe(true);
  });

  it("rejects skipping straight from draft to published", () => {
    expect(isValidWorkflowVersionTransition("draft", "published")).toBe(false);
  });

  it("rejects any transition out of published back to draft or validated (immutability)", () => {
    expect(isValidWorkflowVersionTransition("published", "draft")).toBe(false);
    expect(isValidWorkflowVersionTransition("published", "validated")).toBe(
      false,
    );
  });

  it("retired is terminal", () => {
    for (const candidate of ALL) {
      expect(isValidWorkflowVersionTransition("retired", candidate)).toBe(
        false,
      );
    }
  });

  it("assertValidWorkflowVersionTransition throws on an invalid move", () => {
    expect(() =>
      assertValidWorkflowVersionTransition("draft", "retired"),
    ).toThrow(InvalidWorkflowVersionTransitionError);
  });

  it("assertValidWorkflowVersionTransition does not throw on a valid move", () => {
    expect(() =>
      assertValidWorkflowVersionTransition("draft", "validated"),
    ).not.toThrow();
  });
});
