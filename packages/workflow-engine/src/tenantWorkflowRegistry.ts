import type { Queryable } from "@repo/shared";

export interface TenantWorkflowInstallation {
  id: string;
  tenantId: string;
  workflowDefinitionId: string;
  workflowVersionId: string;
  enabled: boolean;
  configuration: Record<string, unknown>;
  installedAt: string;
  updatedAt: string;
}

/**
 * Resolves workflows *installed for a specific tenant* — configuration and
 * the exact version pinned at install time. Workflow execution must resolve
 * through this registry, never `PlatformWorkflowCatalog` alone.
 */
export interface TenantWorkflowRegistry {
  get(
    tenantId: string,
    workflowDefinitionId: string,
  ): Promise<TenantWorkflowInstallation | null>;
  list(tenantId: string): Promise<TenantWorkflowInstallation[]>;
  setEnabled(tenantWorkflowId: string, enabled: boolean): Promise<void>;
}

type TenantWorkflowRow = {
  id: string;
  tenant_id: string;
  workflow_definition_id: string;
  workflow_version_id: string;
  enabled: boolean;
  configuration: Record<string, unknown>;
  installed_at: string;
  updated_at: string;
};

function mapRow(row: TenantWorkflowRow): TenantWorkflowInstallation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    workflowDefinitionId: row.workflow_definition_id,
    workflowVersionId: row.workflow_version_id,
    enabled: row.enabled,
    configuration: row.configuration,
    installedAt: row.installed_at,
    updatedAt: row.updated_at,
  };
}

export class PgTenantWorkflowRegistry implements TenantWorkflowRegistry {
  constructor(private readonly db: Queryable) {}

  async get(
    tenantId: string,
    workflowDefinitionId: string,
  ): Promise<TenantWorkflowInstallation | null> {
    const { rows } = await this.db.query<TenantWorkflowRow>(
      "select * from tenant_workflows where tenant_id = $1 and workflow_definition_id = $2",
      [tenantId, workflowDefinitionId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async list(tenantId: string): Promise<TenantWorkflowInstallation[]> {
    const { rows } = await this.db.query<TenantWorkflowRow>(
      "select * from tenant_workflows where tenant_id = $1 order by installed_at",
      [tenantId],
    );
    return rows.map(mapRow);
  }

  async setEnabled(tenantWorkflowId: string, enabled: boolean): Promise<void> {
    await this.db.query(
      "update tenant_workflows set enabled = $1, updated_at = now() where id = $2",
      [enabled, tenantWorkflowId],
    );
  }
}
