import { describe, expect, it } from "vitest";
import {
  WorkflowStatusSchema,
  TERMINAL_WORKFLOW_STATUSES,
  isTerminalWorkflowStatus,
  isValidWorkflowTransition,
  assertValidWorkflowTransition,
  InvalidWorkflowTransitionError,
  type WorkflowStatus,
} from "../src/status.js";

const ALL_STATUSES = WorkflowStatusSchema.options;

describe("WorkflowStatusSchema", () => {
  it("accepts exactly the 15 statuses required by the brief", () => {
    expect(ALL_STATUSES).toEqual([
      "DRAFT",
      "PLANNING",
      "WAITING_FOR_APPROVAL",
      "QUEUED",
      "RUNNING",
      "RETRYING",
      "BLOCKED",
      "PAUSED",
      "WAITING_FOR_INPUT",
      "VALIDATING",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
      "REJECTED",
      "EXPIRED",
    ]);
  });

  it("rejects an unknown status string", () => {
    expect(() => WorkflowStatusSchema.parse("IN_PROGRESS")).toThrow();
  });
});

describe("terminal statuses", () => {
  it("matches the documented terminal set", () => {
    expect(TERMINAL_WORKFLOW_STATUSES).toEqual([
      "COMPLETED",
      "FAILED",
      "CANCELLED",
      "REJECTED",
      "EXPIRED",
    ]);
  });

  it("every terminal status has zero valid outgoing transitions", () => {
    for (const terminal of TERMINAL_WORKFLOW_STATUSES) {
      for (const candidate of ALL_STATUSES) {
        expect(isValidWorkflowTransition(terminal, candidate)).toBe(false);
      }
    }
  });

  it("isTerminalWorkflowStatus agrees with the terminal set for every status", () => {
    for (const status of ALL_STATUSES) {
      expect(isTerminalWorkflowStatus(status)).toBe(TERMINAL_WORKFLOW_STATUSES.includes(status));
    }
  });
});

describe("non-terminal statuses", () => {
  it("every non-terminal status has at least one valid outgoing transition", () => {
    for (const status of ALL_STATUSES) {
      if (isTerminalWorkflowStatus(status)) continue;
      const hasAny = ALL_STATUSES.some((candidate) => isValidWorkflowTransition(status, candidate));
      expect(hasAny).toBe(true);
    }
  });

  it("every non-terminal status can reach CANCELLED", () => {
    for (const status of ALL_STATUSES) {
      if (isTerminalWorkflowStatus(status)) continue;
      expect(isValidWorkflowTransition(status, "CANCELLED")).toBe(true);
    }
  });
});

describe("isValidWorkflowTransition / assertValidWorkflowTransition", () => {
  const validCases: [WorkflowStatus, WorkflowStatus][] = [
    ["DRAFT", "PLANNING"],
    ["PLANNING", "WAITING_FOR_APPROVAL"],
    ["WAITING_FOR_APPROVAL", "QUEUED"],
    ["QUEUED", "RUNNING"],
    ["RUNNING", "VALIDATING"],
    ["VALIDATING", "COMPLETED"],
    ["RUNNING", "RETRYING"],
    ["RETRYING", "RUNNING"],
  ];

  it.each(validCases)("allows %s -> %s", (from, to) => {
    expect(isValidWorkflowTransition(from, to)).toBe(true);
    expect(() => assertValidWorkflowTransition(from, to)).not.toThrow();
  });

  const invalidCases: [WorkflowStatus, WorkflowStatus][] = [
    ["DRAFT", "COMPLETED"],
    ["DRAFT", "RUNNING"],
    ["COMPLETED", "RUNNING"],
    ["FAILED", "RUNNING"],
    ["QUEUED", "COMPLETED"],
    ["WAITING_FOR_APPROVAL", "COMPLETED"],
  ];

  it.each(invalidCases)("rejects %s -> %s", (from, to) => {
    expect(isValidWorkflowTransition(from, to)).toBe(false);
    expect(() => assertValidWorkflowTransition(from, to)).toThrow(InvalidWorkflowTransitionError);
  });

  it("the thrown error records the attempted transition", () => {
    try {
      assertValidWorkflowTransition("COMPLETED", "RUNNING");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidWorkflowTransitionError);
      const typed = err as InvalidWorkflowTransitionError;
      expect(typed.from).toBe("COMPLETED");
      expect(typed.to).toBe("RUNNING");
    }
  });
});
