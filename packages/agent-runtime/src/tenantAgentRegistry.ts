import type { Queryable } from "@repo/shared";
import {
  assertValidTenantAgentTransition,
  type TenantAgentLifecycleStatus,
} from "./tenantAgentLifecycle.js";

export interface TenantAgentInstallation {
  id: string;
  tenantId: string;
  agentDefinitionId: string;
  agentVersionId: string;
  displayNameOverride: string | null;
  lifecycleStatus: TenantAgentLifecycleStatus;
  enabled: boolean;
  configuration: Record<string, unknown>;
  executionPolicy: Record<string, unknown>;
  approvalPolicy: Record<string, unknown>;
  installedAt: string;
  updatedAt: string;
}

/**
 * Resolves agents *installed for a specific tenant* — configuration,
 * lifecycle, and the exact version pinned at install time. Agent execution
 * must resolve through this registry, never `PlatformAgentCatalog` alone.
 */
export interface TenantAgentRegistry {
  get(
    tenantId: string,
    agentDefinitionId: string,
  ): Promise<TenantAgentInstallation | null>;
  list(tenantId: string): Promise<TenantAgentInstallation[]>;
  transitionLifecycle(
    tenantAgentId: string,
    to: TenantAgentLifecycleStatus,
  ): Promise<void>;
  setEnabled(tenantAgentId: string, enabled: boolean): Promise<void>;
}

type TenantAgentRow = {
  id: string;
  tenant_id: string;
  agent_definition_id: string;
  agent_version_id: string;
  display_name_override: string | null;
  lifecycle_status: TenantAgentLifecycleStatus;
  enabled: boolean;
  configuration: Record<string, unknown>;
  execution_policy: Record<string, unknown>;
  approval_policy: Record<string, unknown>;
  installed_at: string;
  updated_at: string;
};

function mapRow(row: TenantAgentRow): TenantAgentInstallation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    agentDefinitionId: row.agent_definition_id,
    agentVersionId: row.agent_version_id,
    displayNameOverride: row.display_name_override,
    lifecycleStatus: row.lifecycle_status,
    enabled: row.enabled,
    configuration: row.configuration,
    executionPolicy: row.execution_policy,
    approvalPolicy: row.approval_policy,
    installedAt: row.installed_at,
    updatedAt: row.updated_at,
  };
}

export class PgTenantAgentRegistry implements TenantAgentRegistry {
  constructor(private readonly db: Queryable) {}

  async get(
    tenantId: string,
    agentDefinitionId: string,
  ): Promise<TenantAgentInstallation | null> {
    const { rows } = await this.db.query<TenantAgentRow>(
      "select * from tenant_agents where tenant_id = $1 and agent_definition_id = $2",
      [tenantId, agentDefinitionId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async list(tenantId: string): Promise<TenantAgentInstallation[]> {
    const { rows } = await this.db.query<TenantAgentRow>(
      "select * from tenant_agents where tenant_id = $1 order by installed_at",
      [tenantId],
    );
    return rows.map(mapRow);
  }

  async transitionLifecycle(
    tenantAgentId: string,
    to: TenantAgentLifecycleStatus,
  ): Promise<void> {
    const { rows } = await this.db.query<{
      lifecycle_status: TenantAgentLifecycleStatus;
    }>("select lifecycle_status from tenant_agents where id = $1", [
      tenantAgentId,
    ]);
    const current = rows[0];
    if (!current) {
      throw new Error(`tenant_agents row "${tenantAgentId}" not found`);
    }
    assertValidTenantAgentTransition(current.lifecycle_status, to);
    await this.db.query(
      "update tenant_agents set lifecycle_status = $1, updated_at = now() where id = $2",
      [to, tenantAgentId],
    );
  }

  async setEnabled(tenantAgentId: string, enabled: boolean): Promise<void> {
    await this.db.query(
      "update tenant_agents set enabled = $1, updated_at = now() where id = $2",
      [enabled, tenantAgentId],
    );
  }
}
