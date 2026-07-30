import type { RetryPolicy } from "./manifest.js";

/**
 * Structured error shape, never a raw exception matched by string — the
 * retry decision is data-driven and testable without needing to trigger a
 * real failure mode.
 */
export interface StepError {
  retryable: boolean;
  code: string;
  message: string;
}

export type RetryOutcome =
  | { kind: "RETRY_SCHEDULED"; nextAttemptAt: Date }
  | { kind: "DEAD_LETTERED" }
  | { kind: "FAILED" };

/**
 * Computes the delay before the next attempt, given the attempt number that
 * just failed (1-indexed) and the manifest's retry policy.
 */
export function computeNextAttemptDelayMs(
  attempt: number,
  retryPolicy: Pick<RetryPolicy, "backoff" | "backoffMs">,
): number {
  if (retryPolicy.backoff === "fixed") {
    return retryPolicy.backoffMs;
  }
  return retryPolicy.backoffMs * 2 ** (attempt - 1);
}

/**
 * The deterministic retry/dead-letter decision (§8 of the Phase 3 design):
 * on a step failure, computed once, not by transitioning through
 * intermediate states.
 */
export function classifyOutcome(
  attempt: number,
  retryPolicy: RetryPolicy,
  error: StepError,
  now: Date = new Date(),
): RetryOutcome {
  if (error.retryable && attempt < retryPolicy.maxAttempts) {
    const delayMs = computeNextAttemptDelayMs(attempt, retryPolicy);
    return {
      kind: "RETRY_SCHEDULED",
      nextAttemptAt: new Date(now.getTime() + delayMs),
    };
  }
  if (retryPolicy.deadLetterOnExhaustion) {
    return { kind: "DEAD_LETTERED" };
  }
  return { kind: "FAILED" };
}
