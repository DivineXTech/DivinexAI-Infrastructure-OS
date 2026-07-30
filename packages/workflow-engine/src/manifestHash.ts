import { computeContentHash } from "@repo/platform-kernel";
import {
  WorkflowManifestMetadataSchema,
  type WorkflowManifest,
} from "./manifest.js";

/**
 * Deterministic integrity hash of a workflow manifest's *metadata* (never
 * its inputSchema/outputSchema, which are code, not serializable data).
 * Used by `seedPlatformWorkflowCatalog.ts` to detect "manifest changed
 * without a version bump" before writing anything. Thin-wraps
 * `platform-kernel`'s `computeContentHash` (`ADR-0014`) — the
 * canonicalize-then-hash algorithm itself is defined exactly once, shared
 * with `agent-runtime`'s `manifestHash.ts`.
 */
export function computeWorkflowManifestHash(
  manifest: WorkflowManifest,
): string {
  const metadata = WorkflowManifestMetadataSchema.parse(manifest);
  return computeContentHash(metadata);
}
