import { describe, expect, it, vi } from "vitest";
import {
  computeBackoffDelayMs,
  hasAttemptsRemaining,
  withRetry,
} from "@/src/lib/retry";
import type { RetryPolicy } from "@/src/types/graph";

const policy: RetryPolicy = {
  maxAttempts: 4,
  backoff: "exponential",
  initialDelayMs: 1_000,
  maxDelayMs: 5_000,
};

describe("computeBackoffDelayMs", () => {
  it("grows exponentially with attempt number", () => {
    expect(computeBackoffDelayMs(policy, 1)).toBe(1_000);
    expect(computeBackoffDelayMs(policy, 2)).toBe(2_000);
    expect(computeBackoffDelayMs(policy, 3)).toBe(4_000);
  });

  it("clamps to maxDelayMs", () => {
    expect(computeBackoffDelayMs(policy, 4)).toBe(5_000);
    expect(computeBackoffDelayMs(policy, 10)).toBe(5_000);
  });

  it("uses a fixed delay for fixed backoff", () => {
    const fixed: RetryPolicy = { ...policy, backoff: "fixed" };
    expect(computeBackoffDelayMs(fixed, 1)).toBe(1_000);
    expect(computeBackoffDelayMs(fixed, 5)).toBe(1_000);
  });
});

describe("hasAttemptsRemaining", () => {
  it("is true while under maxAttempts", () => {
    expect(hasAttemptsRemaining(policy, 1)).toBe(true);
    expect(hasAttemptsRemaining(policy, 3)).toBe(true);
  });

  it("is false once maxAttempts is reached", () => {
    expect(hasAttemptsRemaining(policy, 4)).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(policy, fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and eventually succeeds", async () => {
    const fastPolicy: RetryPolicy = { ...policy, initialDelayMs: 1, maxDelayMs: 2 };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValueOnce("ok");

    const result = await withRetry(fastPolicy, fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the final error once attempts are exhausted", async () => {
    const fastPolicy: RetryPolicy = { ...policy, maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 2 };
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(withRetry(fastPolicy, fn)).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
