import type { Queryable, TenantAccessEvaluator } from "@repo/shared";
import { TenantAuthorizationError, recordAuditEvent } from "@repo/shared";
import { computeContentHash } from "@repo/platform-kernel";
import {
  PolicyOverrideDocumentSchema,
  type PolicyOverrideDocument,
} from "./policyDocument.js";
import type { PlatformPolicyCatalog } from "./platformPolicyCatalog.js";
import type {
  TenantPolicyAssignment,
  TenantPolicyOverride,
} from "./tenantPolicyRegistry.js";

export interface ProvisionTenantPolicyInput {
  tenantId: string;
  actorUserId: string;
  policyDefinitionId: string;
  policyVersionId: string;
  enabled?: boolean;
  configuration?: Record<string, unknown>;
}

export interface ProvisionTenantPolicyResult {
  assignment: TenantPolicyAssignment;
  created: boolean;
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

/**
 * Idempotent, explicit provisioning of one policy assignment for a tenant
 * — mirrors `provisionTenantWorkflow`. Note this is the vehicle for
 * opting a tenant *out* of a default-on platform policy (`enabled: false`)
 * or curating tenant-specific configuration; a platform default,
 * non-mandatory policy is already active for a tenant with no row at all
 * (§4b tier 2) — this function is not a prerequisite for that.
 */
export async function provisionTenantPolicy(
  db: Queryable,
  access: TenantAccessEvaluator,
  input: ProvisionTenantPolicyInput,
): Promise<ProvisionTenantPolicyResult> {
  const decision = await access.checkPermission({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permissionKey: "tenant.manage_policies",
  });
  if (!decision.allowed) {
    throw new TenantAuthorizationError(decision.reason);
  }

  const { rows } = await db.query<AssignmentRow>(
    `insert into tenant_policy_assignments
       (tenant_id, policy_definition_id, policy_version_id, enabled, configuration)
     values ($1, $2, $3, $4, $5::jsonb)
     on conflict (tenant_id, policy_definition_id) do nothing
     returning *`,
    [
      input.tenantId,
      input.policyDefinitionId,
      input.policyVersionId,
      input.enabled ?? true,
      JSON.stringify(input.configuration ?? {}),
    ],
  );

  const inserted = rows[0];
  if (inserted) {
    const assignment = mapAssignment(inserted);
    await recordAuditEvent(db, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorType: "user",
      eventType: "tenant_policy_assignment.provisioned",
      resourceType: "tenant_policy_assignments",
      resourceId: assignment.id,
      metadata: { policyDefinitionId: input.policyDefinitionId },
    });
    return { assignment, created: true };
  }

  const { rows: existingRows } = await db.query<AssignmentRow>(
    "select * from tenant_policy_assignments where tenant_id = $1 and policy_definition_id = $2",
    [input.tenantId, input.policyDefinitionId],
  );
  return { assignment: mapAssignment(existingRows[0]!), created: false };
}

export class ImmutablePolicyOverrideError extends Error {
  constructor(policyVersionId: string) {
    super(
      `Policy version "${policyVersionId}" has override_policy = 'immutable' — tenant overrides are not permitted for it`,
    );
    this.name = "ImmutablePolicyOverrideError";
  }
}

export interface CreateTenantPolicyOverrideInput {
  tenantId: string;
  actorUserId: string;
  /** The specific published policy version this override targets — checked directly for `override_policy = 'overridable'` (§4b tier 4). */
  policyVersionId: string;
  override: PolicyOverrideDocument;
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

/**
 * Governed command backing tier 4 of §4b. Rejects overrides targeting an
 * `'immutable'` policy version at write time, before the override ever
 * reaches evaluation — the schema shape (§3c) additionally guarantees the
 * override itself can only tighten, never loosen.
 */
export async function createTenantPolicyOverride(
  db: Queryable,
  catalog: PlatformPolicyCatalog,
  access: TenantAccessEvaluator,
  input: CreateTenantPolicyOverrideInput,
): Promise<TenantPolicyOverride> {
  const decision = await access.checkPermission({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permissionKey: "tenant.manage_policies",
  });
  if (!decision.allowed) {
    throw new TenantAuthorizationError(decision.reason);
  }

  const version = await catalog.getVersion(input.policyVersionId);
  if (!version) {
    throw new Error(`Policy version "${input.policyVersionId}" not found`);
  }
  if (version.overridePolicy === "immutable") {
    throw new ImmutablePolicyOverrideError(input.policyVersionId);
  }

  const document = PolicyOverrideDocumentSchema.parse(input.override);
  const overrideHash = computeContentHash(document);

  const { rows } = await db.query<OverrideRow>(
    `insert into tenant_policy_overrides
       (tenant_id, policy_definition_id, override_document, override_hash, enabled, created_by_user_id)
     values ($1, $2, $3::jsonb, $4, true, $5)
     on conflict (tenant_id, policy_definition_id) do update
       set override_document = excluded.override_document,
           override_hash = excluded.override_hash,
           enabled = true,
           updated_at = now()
     returning *`,
    [
      input.tenantId,
      version.policyDefinitionId,
      JSON.stringify(document),
      overrideHash,
      input.actorUserId,
    ],
  );

  const override = mapOverride(rows[0]!);
  await recordAuditEvent(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actorType: "user",
    eventType: "tenant_policy_override.created",
    resourceType: "tenant_policy_overrides",
    resourceId: override.id,
    metadata: { policyDefinitionId: version.policyDefinitionId },
  });
  return override;
}
