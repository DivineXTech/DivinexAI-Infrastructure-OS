import type { Queryable } from "@repo/shared";
import type { RiskLevel } from "./policyDocument.js";
import type { RiskClassificationVersionStatus } from "./riskClassificationVersionLifecycle.js";

export interface RiskClassificationDefinition {
  id: string;
  action: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskClassificationVersion {
  id: string;
  riskClassificationDefinitionId: string;
  version: string;
  riskLevel: RiskLevel;
  rationale: string;
  classificationHash: string;
  status: RiskClassificationVersionStatus;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  publishedAt: string | null;
  deprecatedAt: string | null;
  createdAt: string;
}

/**
 * Read access to the platform-owned risk classification catalog
 * (`risk_classification_definitions`/`risk_classification_versions`).
 * Keyed by `action` (unique, including the reserved `"*"` platform-wide
 * default) rather than a slug — this catalog identifies a governed action,
 * not a named policy.
 */
export interface PlatformRiskClassificationCatalog {
  getDefinitionByAction(
    action: string,
  ): Promise<RiskClassificationDefinition | null>;
  listDefinitions(): Promise<RiskClassificationDefinition[]>;
  getVersion(
    riskClassificationVersionId: string,
  ): Promise<RiskClassificationVersion | null>;
  listPublishedVersions(
    riskClassificationDefinitionId: string,
  ): Promise<RiskClassificationVersion[]>;
  /** The single published version for an action, resolved directly by action string (§4c's floor lookup). */
  getPublishedVersionForAction(
    action: string,
  ): Promise<RiskClassificationVersion | null>;
}

type DefinitionRow = {
  id: string;
  action: string;
  created_at: string;
  updated_at: string;
};

function mapDefinition(row: DefinitionRow): RiskClassificationDefinition {
  return {
    id: row.id,
    action: row.action,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type VersionRow = {
  id: string;
  risk_classification_definition_id: string;
  version: string;
  risk_level: RiskLevel;
  rationale: string;
  classification_hash: string;
  status: RiskClassificationVersionStatus;
  effective_from: string | null;
  effective_until: string | null;
  published_at: string | null;
  deprecated_at: string | null;
  created_at: string;
};

function mapVersion(row: VersionRow): RiskClassificationVersion {
  return {
    id: row.id,
    riskClassificationDefinitionId: row.risk_classification_definition_id,
    version: row.version,
    riskLevel: row.risk_level,
    rationale: row.rationale,
    classificationHash: row.classification_hash,
    status: row.status,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    publishedAt: row.published_at,
    deprecatedAt: row.deprecated_at,
    createdAt: row.created_at,
  };
}

export class PgPlatformRiskClassificationCatalog
  implements PlatformRiskClassificationCatalog
{
  constructor(private readonly db: Queryable) {}

  async getDefinitionByAction(
    action: string,
  ): Promise<RiskClassificationDefinition | null> {
    const { rows } = await this.db.query<DefinitionRow>(
      "select * from risk_classification_definitions where action = $1",
      [action],
    );
    return rows[0] ? mapDefinition(rows[0]) : null;
  }

  async listDefinitions(): Promise<RiskClassificationDefinition[]> {
    const { rows } = await this.db.query<DefinitionRow>(
      "select * from risk_classification_definitions order by action",
    );
    return rows.map(mapDefinition);
  }

  async getVersion(
    riskClassificationVersionId: string,
  ): Promise<RiskClassificationVersion | null> {
    const { rows } = await this.db.query<VersionRow>(
      "select * from risk_classification_versions where id = $1",
      [riskClassificationVersionId],
    );
    return rows[0] ? mapVersion(rows[0]) : null;
  }

  async listPublishedVersions(
    riskClassificationDefinitionId: string,
  ): Promise<RiskClassificationVersion[]> {
    const { rows } = await this.db.query<VersionRow>(
      "select * from risk_classification_versions where risk_classification_definition_id = $1 and status = 'published' order by created_at",
      [riskClassificationDefinitionId],
    );
    return rows.map(mapVersion);
  }

  async getPublishedVersionForAction(
    action: string,
  ): Promise<RiskClassificationVersion | null> {
    const { rows } = await this.db.query<VersionRow>(
      `select rcv.*
       from risk_classification_versions rcv
       join risk_classification_definitions rcd on rcd.id = rcv.risk_classification_definition_id
       where rcd.action = $1 and rcv.status = 'published'
       order by rcv.created_at desc
       limit 1`,
      [action],
    );
    return rows[0] ? mapVersion(rows[0]) : null;
  }
}
