import { computeContentHash } from "@repo/platform-kernel";
import { AgentManifestMetadataSchema, type AgentManifest } from "./manifest.js";

/**
 * Deterministic integrity hash of a manifest's *metadata* (never its
 * inputSchema/outputSchema, which are code, not serializable data). Used by
 * `seedPlatformCatalog.ts` to detect "manifest changed without a version
 * bump" before writing anything. Thin-wraps `platform-kernel`'s
 * `computeContentHash` (`ADR-0014`) — the canonicalize-then-hash algorithm
 * itself is defined exactly once, shared with `workflow-engine`'s
 * `manifestHash.ts`.
 */
export function computeManifestHash(manifest: AgentManifest): string {
  const metadata = AgentManifestMetadataSchema.parse(manifest);
  return computeContentHash(metadata);
}
