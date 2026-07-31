import type { Queryable } from "@repo/shared";
import type { RiskLevel } from "./policyDocument.js";
import { computeRiskClassificationHash } from "./contentHash.js";

export interface RiskClassificationSeed {
  /** The governed action string, or `"*"` for the platform-wide default floor. */
  action: string;
  version: string;
  riskLevel: RiskLevel;
  rationale: string;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
}

/**
 * Derives the platform risk-classification catalog seed from in-code seed
 * objects, mirroring `seedPlatformPolicyCatalog`. Idempotent; throws if an
 * already-published version's content changed without a version bump.
 */
export async function seedPlatformRiskClassificationCatalog(
  db: Queryable,
  seeds: readonly RiskClassificationSeed[],
): Promise<void> {
  for (const seed of seeds) {
    const classificationHash = computeRiskClassificationHash({
      action: seed.action,
      riskLevel: seed.riskLevel,
      rationale: seed.rationale,
    });

    const { rows: definitionRows } = await db.query<{ id: string }>(
      `insert into risk_classification_definitions (action)
       values ($1)
       on conflict (action) do update set updated_at = now()
       returning id`,
      [seed.action],
    );
    const definitionId = definitionRows[0]!.id;

    const { rows: existingVersionRows } = await db.query<{
      classification_hash: string;
    }>(
      "select classification_hash from risk_classification_versions where risk_classification_definition_id = $1 and version = $2",
      [definitionId, seed.version],
    );
    const existing = existingVersionRows[0];

    if (existing) {
      if (existing.classification_hash !== classificationHash) {
        throw new Error(
          `Risk classification for action "${seed.action}" version ${seed.version} changed without a version bump ` +
            `(stored hash ${existing.classification_hash} != computed hash ${classificationHash}). ` +
            "Bump the version before re-seeding.",
        );
      }
      continue;
    }

    await db.query(
      `insert into risk_classification_versions
         (risk_classification_definition_id, version, risk_level, rationale,
          classification_hash, status, effective_from, effective_until, published_at)
       values ($1, $2, $3, $4, $5, 'published', $6, $7, now())`,
      [
        definitionId,
        seed.version,
        seed.riskLevel,
        seed.rationale,
        classificationHash,
        seed.effectiveFrom ?? null,
        seed.effectiveUntil ?? null,
      ],
    );
  }
}
