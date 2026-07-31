import type { Queryable } from "@repo/shared";
import { PolicyDocumentSchema, type PolicyDocument } from "./policyDocument.js";
import { computePolicyHash } from "./contentHash.js";

export interface PolicySeed {
  slug: string;
  displayName: string;
  description: string;
  version: string;
  document: PolicyDocument;
  priority: number;
  mandatory: boolean;
  overridePolicy: "immutable" | "overridable";
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
}

/**
 * Derives the platform policy catalog seed from in-code seed objects rather
 * than a hand-written SQL literal, mirroring `seedPlatformWorkflowCatalog`.
 * Idempotent: re-running with unchanged documents writes nothing new. If a
 * document's content changed without its `version` field being bumped,
 * throws rather than silently overwriting an already-published version.
 */
export async function seedPlatformPolicyCatalog(
  db: Queryable,
  seeds: readonly PolicySeed[],
): Promise<void> {
  for (const seed of seeds) {
    const document = PolicyDocumentSchema.parse(seed.document);
    const policyHash = computePolicyHash(document);

    const { rows: definitionRows } = await db.query<{ id: string }>(
      `insert into policy_definitions (slug, display_name, description)
       values ($1, $2, $3)
       on conflict (slug) do update
         set display_name = excluded.display_name,
             description = excluded.description,
             updated_at = now()
       returning id`,
      [seed.slug, seed.displayName, seed.description],
    );
    const definitionId = definitionRows[0]!.id;

    const { rows: existingVersionRows } = await db.query<{
      policy_hash: string;
    }>(
      "select policy_hash from policy_versions where policy_definition_id = $1 and version = $2",
      [definitionId, seed.version],
    );
    const existing = existingVersionRows[0];

    if (existing) {
      if (existing.policy_hash !== policyHash) {
        throw new Error(
          `Policy "${seed.slug}" version ${seed.version} document changed without a version bump ` +
            `(stored hash ${existing.policy_hash} != computed hash ${policyHash}). ` +
            "Bump the version before re-seeding.",
        );
      }
      continue;
    }

    await db.query(
      `insert into policy_versions
         (policy_definition_id, version, policy_document, policy_hash, status,
          priority, mandatory, override_policy, effective_from, effective_until, published_at)
       values ($1, $2, $3::jsonb, $4, 'published', $5, $6, $7, $8, $9, now())`,
      [
        definitionId,
        seed.version,
        JSON.stringify(document),
        policyHash,
        seed.priority,
        seed.mandatory,
        seed.overridePolicy,
        seed.effectiveFrom ?? null,
        seed.effectiveUntil ?? null,
      ],
    );
  }
}
