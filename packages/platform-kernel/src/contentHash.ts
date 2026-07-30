import { createHash } from "node:crypto";

/**
 * Recursively sorts object keys (arrays keep their order — order is
 * meaningful there, e.g. a manifest's `responsibilities` list) so two
 * structurally identical values always serialize identically regardless of
 * key declaration order at any depth. `JSON.stringify`'s array-form
 * replacer only filters/orders top-level keys, not nested ones, so it can't
 * do this on its own.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const sortedEntries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    return Object.fromEntries(
      sortedEntries.map(([k, v]) => [k, canonicalize(v)]),
    );
  }
  return value;
}

/**
 * Deterministic sha256 content hash of any JSON-serializable value, after
 * canonicalizing key order at every depth. The single implementation every
 * versioned-artifact package (agent manifests, workflow manifests, future
 * tool manifests / memory snapshots / marketplace packages) hashes through,
 * so "did the content change without a version bump" has exactly one
 * algorithm across the platform.
 */
export function computeContentHash(value: unknown): string {
  const canonical = JSON.stringify(canonicalize(value));
  return createHash("sha256").update(canonical).digest("hex");
}
