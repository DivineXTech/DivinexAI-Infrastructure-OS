import type { Queryable } from "@repo/shared";
import {
  AgentManifestMetadataSchema,
  validateAgentManifest,
  type AgentManifest,
} from "./manifest.js";
import { computeManifestHash } from "./manifestHash.js";

/**
 * Derives the platform catalog seed from the actual manifest objects in
 * code, rather than a hand-written SQL literal that could drift from them.
 * Idempotent: re-running with unchanged manifests writes nothing new. If a
 * manifest's content changed without its `version` field being bumped, this
 * throws rather than silently overwriting an already-published version —
 * publishing is meant to be immutable (`ADR-0013` addendum).
 */
export async function seedPlatformAgentCatalog(
  db: Queryable,
  manifests: readonly AgentManifest[],
): Promise<void> {
  for (const manifest of manifests) {
    validateAgentManifest(manifest);
    const metadata = AgentManifestMetadataSchema.parse(manifest);
    const manifestHash = computeManifestHash(manifest);

    const { rows: definitionRows } = await db.query<{ id: string }>(
      `insert into agent_definitions (slug, display_name, role, description)
       values ($1, $2, $3, $4)
       on conflict (slug) do update
         set display_name = excluded.display_name,
             role = excluded.role,
             description = excluded.description,
             updated_at = now()
       returning id`,
      [manifest.id, manifest.displayName, manifest.role, manifest.mission],
    );
    const definitionId = definitionRows[0]!.id;

    const { rows: existingVersionRows } = await db.query<{
      manifest_hash: string;
    }>(
      "select manifest_hash from agent_versions where agent_definition_id = $1 and version = $2",
      [definitionId, manifest.version],
    );
    const existing = existingVersionRows[0];

    if (existing) {
      if (existing.manifest_hash !== manifestHash) {
        throw new Error(
          `Agent "${manifest.id}" version ${manifest.version} manifest changed without a version bump ` +
            `(stored hash ${existing.manifest_hash} != computed hash ${manifestHash}). ` +
            "Bump the version in the manifest before re-seeding.",
        );
      }
      continue;
    }

    await db.query(
      `insert into agent_versions
         (agent_definition_id, version, manifest, manifest_hash, status, published_at)
       values ($1, $2, $3::jsonb, $4, 'published', now())`,
      [definitionId, manifest.version, JSON.stringify(metadata), manifestHash],
    );
  }
}
