import { describe, expect, it } from "vitest";
import {
  ApprovalRequestStatusSchema,
  TERMINAL_APPROVAL_REQUEST_STATUSES,
  isTerminalApprovalRequestStatus,
  isValidApprovalTransition,
  assertValidApprovalTransition,
  InvalidApprovalTransitionError,
} from "../src/approvalRequestLifecycle.js";

const ALL_STATUSES = ApprovalRequestStatusSchema.options;

describe("ApprovalRequestStatusSchema", () => {
  it("has exactly the 8 states, 5 terminal", () => {
    expect(ALL_STATUSES).toEqual([
      "PENDING",
      "ASSIGNED",
      "PARTIALLY_APPROVED",
      "APPROVED",
      "REJECTED",
      "EXPIRED",
      "CANCELLED",
      "SUPERSEDED",
    ]);
    expect(TERMINAL_APPROVAL_REQUEST_STATUSES).toEqual([
      "APPROVED",
      "REJECTED",
      "EXPIRED",
      "CANCELLED",
      "SUPERSEDED",
    ]);
  });

  it("isTerminalApprovalRequestStatus agrees with the terminal set for every status", () => {
    for (const status of ALL_STATUSES) {
      expect(isTerminalApprovalRequestStatus(status)).toBe(
        TERMINAL_APPROVAL_REQUEST_STATUSES.includes(status),
      );
    }
  });

  it("every terminal status has zero valid outgoing transitions", () => {
    for (const terminal of TERMINAL_APPROVAL_REQUEST_STATUSES) {
      for (const candidate of ALL_STATUSES) {
        expect(isValidApprovalTransition(terminal, candidate)).toBe(false);
      }
    }
  });
});

describe("isValidApprovalTransition / assertValidApprovalTransition", () => {
  const validCases = [
    ["PENDING", "ASSIGNED"],
    ["PENDING", "EXPIRED"],
    ["PENDING", "CANCELLED"],
    ["PENDING", "SUPERSEDED"],
    ["ASSIGNED", "PARTIALLY_APPROVED"],
    ["ASSIGNED", "APPROVED"],
    ["ASSIGNED", "REJECTED"],
    ["PARTIALLY_APPROVED", "APPROVED"],
    ["PARTIALLY_APPROVED", "REJECTED"],
  ] as const;

  it.each(validCases)("allows %s -> %s", (from, to) => {
    expect(isValidApprovalTransition(from, to)).toBe(true);
    expect(() => assertValidApprovalTransition(from, to)).not.toThrow();
  });

  const invalidCases = [
    ["PENDING", "APPROVED"],
    ["PENDING", "REJECTED"],
    ["PENDING", "PARTIALLY_APPROVED"],
    ["APPROVED", "REJECTED"],
    ["REJECTED", "APPROVED"],
  ] as const;

  it.each(invalidCases)(
    "rejects %s -> %s (PENDING cannot skip straight to a decided state)",
    (from, to) => {
      expect(isValidApprovalTransition(from, to)).toBe(false);
      expect(() => assertValidApprovalTransition(from, to)).toThrow(
        InvalidApprovalTransitionError,
      );
    },
  );
});
