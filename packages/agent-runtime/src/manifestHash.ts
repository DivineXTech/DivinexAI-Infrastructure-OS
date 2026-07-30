import { createHash } from "node:crypto";
import { AgentManifestMetadataSchema, type AgentManifest } from "./manifest.js";

/**
 * Recursively sorts object keys (arrays keep their order — order is
 * meaningful there, e.g. `responsibilities`) so two structurally identical
 * objects always serialize identically regardless of key declaration order
 * at any depth. `JSON.stringify`'s array-form replacer only filters/orders
 * top-level keys, not nested ones, so it can't do this on its own.
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
 * Deterministic integrity hash of a manifest's *metadata* (never its
 * inputSchema/outputSchema, which are code, not serializable data). Used by
 * `seedPlatformCatalog.ts` to detect "manifest changed without a version
 * bump" before writing anything.
 */
export function computeManifestHash(manifest: AgentManifest): string {
  const metadata = AgentManifestMetadataSchema.parse(manifest);
  const canonical = JSON.stringify(canonicalize(metadata));
  return createHash("sha256").update(canonical).digest("hex");
}
