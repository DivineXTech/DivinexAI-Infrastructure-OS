import { describe, expect, it } from "vitest";
import {
  computeNextAttemptDelayMs,
  classifyOutcome,
  type StepError,
} from "../src/retryPolicy.js";
import type { RetryPolicy } from "../src/manifest.js";

const retryableError: StepError = {
  retryable: true,
  code: "transient_error",
  message: "temporary failure",
};

const nonRetryableError: StepError = {
  retryable: false,
  code: "validation_error",
  message: "permanent failure",
};

function policy(overrides: Partial<RetryPolicy> = {}): RetryPolicy {
  return {
    maxAttempts: 3,
    backoff: "exponential",
    backoffMs: 1000,
    timeoutMs: 60000,
    deadLetterOnExhaustion: true,
    ...overrides,
  };
}

describe("computeNextAttemptDelayMs", () => {
  it("returns a constant delay for fixed backoff", () => {
    const p = policy({ backoff: "fixed", backoffMs: 500 });
    expect(computeNextAttemptDelayMs(1, p)).toBe(500);
    expect(computeNextAttemptDelayMs(2, p)).toBe(500);
    expect(computeNextAttemptDelayMs(3, p)).toBe(500);
  });

  it("doubles the delay per attempt for exponential backoff", () => {
    const p = policy({ backoff: "exponential", backoffMs: 1000 });
    expect(computeNextAttemptDelayMs(1, p)).toBe(1000);
    expect(computeNextAttemptDelayMs(2, p)).toBe(2000);
    expect(computeNextAttemptDelayMs(3, p)).toBe(4000);
  });
});

describe("classifyOutcome", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("schedules a retry when the error is retryable and attempts remain", () => {
    const outcome = classifyOutcome(
      1,
      policy({ maxAttempts: 3 }),
      retryableError,
      now,
    );
    expect(outcome.kind).toBe("RETRY_SCHEDULED");
    if (outcome.kind === "RETRY_SCHEDULED") {
      expect(outcome.nextAttemptAt.getTime()).toBe(now.getTime() + 1000);
    }
  });

  it("dead-letters once attempts are exhausted and deadLetterOnExhaustion is true", () => {
    const outcome = classifyOutcome(
      3,
      policy({ maxAttempts: 3, deadLetterOnExhaustion: true }),
      retryableError,
      now,
    );
    expect(outcome.kind).toBe("DEAD_LETTERED");
  });

  it("fails (not dead-letters) once attempts are exhausted and deadLetterOnExhaustion is false", () => {
    const outcome = classifyOutcome(
      3,
      policy({ maxAttempts: 3, deadLetterOnExhaustion: false }),
      retryableError,
      now,
    );
    expect(outcome.kind).toBe("FAILED");
  });

  it("dead-letters immediately for a non-retryable error, even on the first attempt", () => {
    const outcome = classifyOutcome(
      1,
      policy({ maxAttempts: 3, deadLetterOnExhaustion: true }),
      nonRetryableError,
      now,
    );
    expect(outcome.kind).toBe("DEAD_LETTERED");
  });

  it("fails immediately for a non-retryable error when deadLetterOnExhaustion is false", () => {
    const outcome = classifyOutcome(
      1,
      policy({ maxAttempts: 3, deadLetterOnExhaustion: false }),
      nonRetryableError,
      now,
    );
    expect(outcome.kind).toBe("FAILED");
  });
});
