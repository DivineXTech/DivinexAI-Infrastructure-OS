import type { Queryable } from "@repo/shared";
import {
  WorkflowManifestMetadataSchema,
  validateWorkflowManifest,
  type WorkflowManifest,
} from "./manifest.js";
import { computeWorkflowManifestHash } from "./manifestHash.js";
import type { AgentResolver } from "./agentResolver.js";

/**
 * Derives the platform workflow catalog seed from the actual manifest
 * objects in code, rather than a hand-written SQL literal that could drift
 * from them — mirrors `seedPlatformAgentCatalog`. Idempotent: re-running
 * with unchanged manifests writes nothing new. If a manifest's content
 * changed without its `version` field being bumped, this throws rather than
 * silently overwriting an already-published version.
 */
export async function seedPlatformWorkflowCatalog(
  db: Queryable,
  agentResolver: AgentResolver,
  manifests: readonly WorkflowManifest[],
): Promise<void> {
  for (const manifest of manifests) {
    await validateWorkflowManifest(manifest, agentResolver);
    const metadata = WorkflowManifestMetadataSchema.parse(manifest);
    const manifestHash = computeWorkflowManifestHash(manifest);

    const { rows: definitionRows } = await db.query<{ id: string }>(
      `insert into workflow_definitions (slug, display_name, description)
       values ($1, $2, $3)
       on conflict (slug) do update
         set display_name = excluded.display_name,
             description = excluded.description,
             updated_at = now()
       returning id`,
      [manifest.id, manifest.displayName, manifest.description],
    );
    const definitionId = definitionRows[0]!.id;

    const { rows: existingVersionRows } = await db.query<{
      manifest_hash: string;
    }>(
      "select manifest_hash from workflow_versions where workflow_definition_id = $1 and version = $2",
      [definitionId, manifest.version],
    );
    const existing = existingVersionRows[0];

    if (existing) {
      if (existing.manifest_hash !== manifestHash) {
        throw new Error(
          `Workflow "${manifest.id}" version ${manifest.version} manifest changed without a version bump ` +
            `(stored hash ${existing.manifest_hash} != computed hash ${manifestHash}). ` +
            "Bump the version in the manifest before re-seeding.",
        );
      }
      continue;
    }

    await db.query(
      `insert into workflow_versions
         (workflow_definition_id, version, manifest, manifest_hash, status, published_at)
       values ($1, $2, $3::jsonb, $4, 'published', now())`,
      [definitionId, manifest.version, JSON.stringify(metadata), manifestHash],
    );
  }
}
