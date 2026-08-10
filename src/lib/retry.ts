import type { RetryPolicy } from "@/src/types/graph";

/** Computes the delay before a given retry attempt (1-indexed) under a
 *  RetryPolicy, clamped to maxDelayMs. */
export function computeBackoffDelayMs(
  policy: RetryPolicy,
  attempt: number,
): number {
  if (policy.backoff === "fixed") {
    return Math.min(policy.initialDelayMs, policy.maxDelayMs);
  }
  const delay = policy.initialDelayMs * 2 ** (attempt - 1);
  return Math.min(delay, policy.maxDelayMs);
}

export function hasAttemptsRemaining(
  policy: RetryPolicy,
  attempt: number,
): boolean {
  return attempt < policy.maxAttempts;
}

/**
 * Runs `fn`, retrying on thrown errors per `policy` with backoff. Throws the
 * final error once attempts are exhausted so the caller can route the step
 * to the dead-letter queue.
 */
export async function withRetry<T>(
  policy: RetryPolicy,
  fn: (attempt: number) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (!hasAttemptsRemaining(policy, attempt)) {
        break;
      }
      const delayMs = computeBackoffDelayMs(policy, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
