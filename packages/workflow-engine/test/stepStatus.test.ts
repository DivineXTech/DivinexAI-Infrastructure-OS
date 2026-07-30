import { describe, expect, it } from "vitest";
import {
  WorkflowStepStatusSchema,
  TERMINAL_WORKFLOW_STEP_STATUSES,
  isTerminalWorkflowStepStatus,
  isValidWorkflowStepTransition,
  assertValidWorkflowStepTransition,
  InvalidWorkflowStepTransitionError,
  type WorkflowStepStatus,
} from "../src/stepStatus.js";

const ALL_STATUSES = WorkflowStepStatusSchema.options;

describe("WorkflowStepStatusSchema", () => {
  it("accepts exactly the 14 statuses required by the brief", () => {
    expect(ALL_STATUSES).toEqual([
      "PENDING",
      "READY",
      "LEASED",
      "RUNNING",
      "WAITING_FOR_APPROVAL",
      "WAITING_FOR_INPUT",
      "RETRY_SCHEDULED",
      "SUCCEEDED",
      "FAILED",
      "BLOCKED",
      "CANCELLED",
      "SKIPPED",
      "EXPIRED",
      "DEAD_LETTERED",
    ]);
  });

  it("rejects an unknown status string", () => {
    expect(() => WorkflowStepStatusSchema.parse("IN_PROGRESS")).toThrow();
  });
});

describe("terminal statuses", () => {
  it("matches the documented terminal set", () => {
    expect(TERMINAL_WORKFLOW_STEP_STATUSES).toEqual([
      "SUCCEEDED",
      "FAILED",
      "CANCELLED",
      "SKIPPED",
      "EXPIRED",
      "DEAD_LETTERED",
    ]);
  });

  it("every terminal status has zero valid outgoing transitions", () => {
    for (const terminal of TERMINAL_WORKFLOW_STEP_STATUSES) {
      for (const candidate of ALL_STATUSES) {
        expect(isValidWorkflowStepTransition(terminal, candidate)).toBe(false);
      }
    }
  });

  it("isTerminalWorkflowStepStatus agrees with the terminal set for every status", () => {
    for (const status of ALL_STATUSES) {
      expect(isTerminalWorkflowStepStatus(status)).toBe(
        TERMINAL_WORKFLOW_STEP_STATUSES.includes(status),
      );
    }
  });
});

describe("non-terminal statuses", () => {
  it("every non-terminal status has at least one valid outgoing transition", () => {
    for (const status of ALL_STATUSES) {
      if (isTerminalWorkflowStepStatus(status)) continue;
      const hasAny = ALL_STATUSES.some((candidate) =>
        isValidWorkflowStepTransition(status, candidate),
      );
      expect(hasAny).toBe(true);
    }
  });

  it("every non-terminal status can reach CANCELLED", () => {
    for (const status of ALL_STATUSES) {
      if (isTerminalWorkflowStepStatus(status)) continue;
      expect(isValidWorkflowStepTransition(status, "CANCELLED")).toBe(true);
    }
  });
});

describe("isValidWorkflowStepTransition / assertValidWorkflowStepTransition", () => {
  const validCases: [WorkflowStepStatus, WorkflowStepStatus][] = [
    ["PENDING", "READY"],
    ["READY", "LEASED"],
    ["LEASED", "RUNNING"],
    ["RUNNING", "SUCCEEDED"],
    ["RUNNING", "FAILED"],
    ["RUNNING", "DEAD_LETTERED"],
    ["RUNNING", "RETRY_SCHEDULED"],
    ["RETRY_SCHEDULED", "READY"],
    ["RUNNING", "WAITING_FOR_APPROVAL"],
    ["WAITING_FOR_APPROVAL", "RUNNING"],
    ["RUNNING", "WAITING_FOR_INPUT"],
    ["WAITING_FOR_INPUT", "RUNNING"],
    ["RUNNING", "BLOCKED"],
    ["BLOCKED", "READY"],
    ["LEASED", "EXPIRED"],
  ];

  it.each(validCases)("allows %s -> %s", (from, to) => {
    expect(isValidWorkflowStepTransition(from, to)).toBe(true);
    expect(() => assertValidWorkflowStepTransition(from, to)).not.toThrow();
  });

  const invalidCases: [WorkflowStepStatus, WorkflowStepStatus][] = [
    ["PENDING", "SUCCEEDED"],
    ["PENDING", "RUNNING"],
    ["SUCCEEDED", "RUNNING"],
    ["FAILED", "RUNNING"],
    ["DEAD_LETTERED", "READY"],
    ["READY", "SUCCEEDED"],
    ["RETRY_SCHEDULED", "RUNNING"],
  ];

  it.each(invalidCases)("rejects %s -> %s", (from, to) => {
    expect(isValidWorkflowStepTransition(from, to)).toBe(false);
    expect(() => assertValidWorkflowStepTransition(from, to)).toThrow(
      InvalidWorkflowStepTransitionError,
    );
  });

  it("the thrown error records the attempted transition", () => {
    try {
      assertValidWorkflowStepTransition("SUCCEEDED", "RUNNING");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidWorkflowStepTransitionError);
      const typed = err as InvalidWorkflowStepTransitionError;
      expect(typed.from).toBe("SUCCEEDED");
      expect(typed.to).toBe("RUNNING");
    }
  });

  it("FAILED and DEAD_LETTERED are both reachable directly from RUNNING, not through each other", () => {
    expect(isValidWorkflowStepTransition("RUNNING", "FAILED")).toBe(true);
    expect(isValidWorkflowStepTransition("RUNNING", "DEAD_LETTERED")).toBe(
      true,
    );
    expect(isValidWorkflowStepTransition("FAILED", "DEAD_LETTERED")).toBe(
      false,
    );
    expect(isValidWorkflowStepTransition("DEAD_LETTERED", "FAILED")).toBe(
      false,
    );
  });
});
