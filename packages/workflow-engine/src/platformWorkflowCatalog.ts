import type { Queryable } from "@repo/shared";
import type { WorkflowManifestMetadata } from "./manifest.js";
import type { WorkflowVersionStatus } from "./workflowVersionLifecycle.js";

export interface WorkflowDefinition {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersion {
  id: string;
  workflowDefinitionId: string;
  version: string;
  manifest: WorkflowManifestMetadata;
  manifestHash: string;
  status: WorkflowVersionStatus;
  publishedAt: string | null;
  deprecatedAt: string | null;
  createdAt: string;
}

/**
 * Read/write access to the platform-owned workflow catalog
 * (`workflow_definitions`/`workflow_versions`). Every tenant-facing
 * capability resolves *through* `TenantWorkflowRegistry`, never straight
 * from this catalog — a platform definition alone is not runnable for a
 * tenant, mirroring `PlatformAgentCatalog`'s contract (`ADR-0013` addendum).
 */
export interface PlatformWorkflowCatalog {
  getDefinitionBySlug(slug: string): Promise<WorkflowDefinition | null>;
  listDefinitions(): Promise<WorkflowDefinition[]>;
  getVersion(workflowVersionId: string): Promise<WorkflowVersion | null>;
  listPublishedVersions(
    workflowDefinitionId: string,
  ): Promise<WorkflowVersion[]>;
}

type DefinitionRow = {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

function mapDefinition(row: DefinitionRow): WorkflowDefinition {
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
  workflow_definition_id: string;
  version: string;
  manifest: WorkflowManifestMetadata;
  manifest_hash: string;
  status: WorkflowVersionStatus;
  published_at: string | null;
  deprecated_at: string | null;
  created_at: string;
};

function mapVersion(row: VersionRow): WorkflowVersion {
  return {
    id: row.id,
    workflowDefinitionId: row.workflow_definition_id,
    version: row.version,
    manifest: row.manifest,
    manifestHash: row.manifest_hash,
    status: row.status,
    publishedAt: row.published_at,
    deprecatedAt: row.deprecated_at,
    createdAt: row.created_at,
  };
}

export class PgPlatformWorkflowCatalog implements PlatformWorkflowCatalog {
  constructor(private readonly db: Queryable) {}

  async getDefinitionBySlug(slug: string): Promise<WorkflowDefinition | null> {
    const { rows } = await this.db.query<DefinitionRow>(
      "select * from workflow_definitions where slug = $1",
      [slug],
    );
    return rows[0] ? mapDefinition(rows[0]) : null;
  }

  async listDefinitions(): Promise<WorkflowDefinition[]> {
    const { rows } = await this.db.query<DefinitionRow>(
      "select * from workflow_definitions order by slug",
    );
    return rows.map(mapDefinition);
  }

  async getVersion(workflowVersionId: string): Promise<WorkflowVersion | null> {
    const { rows } = await this.db.query<VersionRow>(
      "select * from workflow_versions where id = $1",
      [workflowVersionId],
    );
    return rows[0] ? mapVersion(rows[0]) : null;
  }

  async listPublishedVersions(
    workflowDefinitionId: string,
  ): Promise<WorkflowVersion[]> {
    const { rows } = await this.db.query<VersionRow>(
      "select * from workflow_versions where workflow_definition_id = $1 and status = 'published' order by created_at",
      [workflowDefinitionId],
    );
    return rows.map(mapVersion);
  }
}
