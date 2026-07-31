import type { Queryable } from "@repo/shared";
import type { PolicyDocument } from "./policyDocument.js";
import type { PolicyVersionStatus } from "./policyVersionLifecycle.js";

export interface PolicyDefinition {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyVersion {
  id: string;
  policyDefinitionId: string;
  version: string;
  policyDocument: PolicyDocument;
  policyHash: string;
  status: PolicyVersionStatus;
  priority: number;
  mandatory: boolean;
  overridePolicy: "immutable" | "overridable";
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  publishedAt: string | null;
  deprecatedAt: string | null;
  createdAt: string;
}

/**
 * Read access to the platform-owned policy catalog
 * (`policy_definitions`/`policy_versions`) — mirrors
 * `PlatformWorkflowCatalog`'s contract exactly.
 */
export interface PlatformPolicyCatalog {
  getDefinitionBySlug(slug: string): Promise<PolicyDefinition | null>;
  listDefinitions(): Promise<PolicyDefinition[]>;
  getVersion(policyVersionId: string): Promise<PolicyVersion | null>;
  listPublishedVersions(policyDefinitionId: string): Promise<PolicyVersion[]>;
  /** Every published policy version whose `appliesToActions` includes this action or "*" (tiers 1-3, §4b). */
  listPublishedVersionsForAction(action: string): Promise<PolicyVersion[]>;
}

type DefinitionRow = {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

function mapDefinition(row: DefinitionRow): PolicyDefinition {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type VersionRow = {
  id: string;
  policy_definition_id: string;
  version: string;
  policy_document: PolicyDocument;
  policy_hash: string;
  status: PolicyVersionStatus;
  priority: number;
  mandatory: boolean;
  override_policy: "immutable" | "overridable";
  effective_from: string | null;
  effective_until: string | null;
  published_at: string | null;
  deprecated_at: string | null;
  created_at: string;
};

function mapVersion(row: VersionRow): PolicyVersion {
  return {
    id: row.id,
    policyDefinitionId: row.policy_definition_id,
    version: row.version,
    policyDocument: row.policy_document,
    policyHash: row.policy_hash,
    status: row.status,
    priority: row.priority,
    mandatory: row.mandatory,
    overridePolicy: row.override_policy,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    publishedAt: row.published_at,
    deprecatedAt: row.deprecated_at,
    createdAt: row.created_at,
  };
}

export class PgPlatformPolicyCatalog implements PlatformPolicyCatalog {
  constructor(private readonly db: Queryable) {}

  async getDefinitionBySlug(slug: string): Promise<PolicyDefinition | null> {
    const { rows } = await this.db.query<DefinitionRow>(
      "select * from policy_definitions where slug = $1",
      [slug],
    );
    return rows[0] ? mapDefinition(rows[0]) : null;
  }

  async listDefinitions(): Promise<PolicyDefinition[]> {
    const { rows } = await this.db.query<DefinitionRow>(
      "select * from policy_definitions order by slug",
    );
    return rows.map(mapDefinition);
  }

  async getVersion(policyVersionId: string): Promise<PolicyVersion | null> {
    const { rows } = await this.db.query<VersionRow>(
      "select * from policy_versions where id = $1",
      [policyVersionId],
    );
    return rows[0] ? mapVersion(rows[0]) : null;
  }

  async listPublishedVersions(
    policyDefinitionId: string,
  ): Promise<PolicyVersion[]> {
    const { rows } = await this.db.query<VersionRow>(
      "select * from policy_versions where policy_definition_id = $1 and status = 'published' order by created_at",
      [policyDefinitionId],
    );
    return rows.map(mapVersion);
  }

  async listPublishedVersionsForAction(
    action: string,
  ): Promise<PolicyVersion[]> {
    const { rows } = await this.db.query<VersionRow>(
      `select pv.*
       from policy_versions pv
       where pv.status = 'published'
         and pv.policy_document -> 'appliesToActions' @> to_jsonb($1::text)
       order by pv.priority, pv.policy_definition_id`,
      [action],
    );
    const wildcardRows =
      action === "*"
        ? []
        : (
            await this.db.query<VersionRow>(
              `select pv.*
               from policy_versions pv
               where pv.status = 'published'
                 and pv.policy_document -> 'appliesToActions' @> '["*"]'::jsonb
               order by pv.priority, pv.policy_definition_id`,
            )
          ).rows;
    const seen = new Set<string>();
    const combined: PolicyVersion[] = [];
    for (const row of [...rows, ...wildcardRows]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      combined.push(mapVersion(row));
    }
    return combined;
  }
}
