/**
 * Best-effort in-memory rate limiter.
 *
 * This is intentionally simple: it protects a single running server process
 * from rapid abuse (a script hammering /api/waitlist). It is NOT a
 * distributed rate limiter — on serverless platforms each cold instance
 * gets its own counters. For production-grade protection at scale, swap
 * this module for Vercel Edge Config / Upstash Redis rate limiting; the
 * call sites (`checkRateLimit`) do not need to change.
 */

interface Bucket {
  count: number;
  windowStartMs: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStartMs >= windowMs) {
    buckets.set(key, { count: 1, windowStartMs: now });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}

/** Periodically drop stale buckets so this map doesn't grow unbounded. */
export function pruneRateLimitBuckets(maxAgeMs: number): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartMs > maxAgeMs) {
      buckets.delete(key);
    }
  }
}
