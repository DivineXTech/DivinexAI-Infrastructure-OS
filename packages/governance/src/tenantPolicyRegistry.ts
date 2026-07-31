import type { Queryable } from "@repo/shared";
import type { PolicyOverrideDocument } from "./policyDocument.js";

export interface TenantPolicyAssignment {
  id: string;
  tenantId: string;
  policyDefinitionId: string;
  policyVersionId: string;
  enabled: boolean;
  configuration: Record<string, unknown>;
  assignedAt: string;
  updatedAt: string;
}

export interface TenantPolicyOverride {
  id: string;
  tenantId: string;
  policyDefinitionId: string;
  overrideDocument: PolicyOverrideDocument;
  overrideHash: string;
  enabled: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Read/enable-toggle access to a tenant's policy configuration
 * (`tenant_policy_assignments`/`tenant_policy_overrides`) — mirrors
 * `TenantWorkflowRegistry`'s contract. Creation/upsert of these rows is a
 * governed command (`provisionTenantPolicy.ts`), not exposed here.
 *
 * **Absence of an assignment row is not "inactive"**: a published,
 * non-mandatory policy version is active by default (§4b tier 2) unless an
 * explicit assignment row disables it (`enabled = false`). `getAssignment`
 * returning `null` means "no explicit opt-out/configuration exists," not
 * "this policy doesn't apply."
 */
export interface TenantPolicyRegistry {
  getAssignment(
    tenantId: string,
    policyDefinitionId: string,
  ): Promise<TenantPolicyAssignment | null>;
  listAssignments(tenantId: string): Promise<TenantPolicyAssignment[]>;
  setAssignmentEnabled(
    tenantPolicyAssignmentId: string,
    enabled: boolean,
  ): Promise<void>;
  getOverride(
    tenantId: string,
    policyDefinitionId: string,
  ): Promise<TenantPolicyOverride | null>;
  listOverrides(tenantId: string): Promise<TenantPolicyOverride[]>;
  setOverrideEnabled(
    tenantPolicyOverrideId: string,
    enabled: boolean,
  ): Promise<void>;
}

type AssignmentRow = {
  id: string;
  tenant_id: string;
  policy_definition_id: string;
  policy_version_id: string;
  enabled: boolean;
  configuration: Record<string, unknown>;
  assigned_at: string;
  updated_at: string;
};

function mapAssignment(row: AssignmentRow): TenantPolicyAssignment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    policyDefinitionId: row.policy_definition_id,
    policyVersionId: row.policy_version_id,
    enabled: row.enabled,
    configuration: row.configuration,
    assignedAt: row.assigned_at,
    updatedAt: row.updated_at,
  };
}

type OverrideRow = {
  id: string;
  tenant_id: string;
  policy_definition_id: string;
  override_document: PolicyOverrideDocument;
  override_hash: string;
  enabled: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapOverride(row: OverrideRow): TenantPolicyOverride {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    policyDefinitionId: row.policy_definition_id,
    overrideDocument: row.override_document,
    overrideHash: row.override_hash,
    enabled: row.enabled,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgTenantPolicyRegistry implements TenantPolicyRegistry {
  constructor(private readonly db: Queryable) {}

  async getAssignment(
    tenantId: string,
    policyDefinitionId: string,
  ): Promise<TenantPolicyAssignment | null> {
    const { rows } = await this.db.query<AssignmentRow>(
      "select * from tenant_policy_assignments where tenant_id = $1 and policy_definition_id = $2",
      [tenantId, policyDefinitionId],
    );
    return rows[0] ? mapAssignment(rows[0]) : null;
  }

  async listAssignments(tenantId: string): Promise<TenantPolicyAssignment[]> {
    const { rows } = await this.db.query<AssignmentRow>(
      "select * from tenant_policy_assignments where tenant_id = $1 order by assigned_at",
      [tenantId],
    );
    return rows.map(mapAssignment);
  }

  async setAssignmentEnabled(
    tenantPolicyAssignmentId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.db.query(
      "update tenant_policy_assignments set enabled = $1, updated_at = now() where id = $2",
      [enabled, tenantPolicyAssignmentId],
    );
  }

  async getOverride(
    tenantId: string,
    policyDefinitionId: string,
  ): Promise<TenantPolicyOverride | null> {
    const { rows } = await this.db.query<OverrideRow>(
      "select * from tenant_policy_overrides where tenant_id = $1 and policy_definition_id = $2",
      [tenantId, policyDefinitionId],
    );
    return rows[0] ? mapOverride(rows[0]) : null;
  }

  async listOverrides(tenantId: string): Promise<TenantPolicyOverride[]> {
    const { rows } = await this.db.query<OverrideRow>(
      "select * from tenant_policy_overrides where tenant_id = $1 order by created_at",
      [tenantId],
    );
    return rows.map(mapOverride);
  }

  async setOverrideEnabled(
    tenantPolicyOverrideId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.db.query(
      "update tenant_policy_overrides set enabled = $1, updated_at = now() where id = $2",
      [enabled, tenantPolicyOverrideId],
    );
  }
}
