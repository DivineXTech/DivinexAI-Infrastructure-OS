import type { Queryable, TenantAccessEvaluator } from "@repo/shared";
import { TenantAuthorizationError, recordAuditEvent } from "@repo/shared";
import type { PlatformWorkflowCatalog } from "./platformWorkflowCatalog.js";
import type { TenantWorkflowInstallation } from "./tenantWorkflowRegistry.js";

export interface ProvisionTenantWorkflowInput {
  tenantId: string;
  actorUserId: string;
  workflowDefinitionSlug: string;
  /**
   * Explicit — never resolved implicitly to "whatever is currently
   * published." Callers that want "the current published version" must
   * resolve it themselves (e.g. via
   * `PlatformWorkflowCatalog.listPublishedVersions`) and pass the result
   * here.
   */
  workflowVersionId: string;
}

export interface ProvisionTenantWorkflowResult {
  installation: TenantWorkflowInstallation;
  created: boolean;
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

/**
 * Idempotent, explicit provisioning of one workflow installation for a
 * tenant — a plain application function, not a database trigger, mirroring
 * `provisionTenantAgents`. Singular (one workflow per call) rather than
 * "all at once," since workflows aren't a fixed enumerable set the way the
 * six canonical agents are. Creates the installation only if missing,
 * defaults to disabled, and records one audit event only when a row is
 * actually created.
 */
export async function provisionTenantWorkflow(
  db: Queryable,
  catalog: PlatformWorkflowCatalog,
  access: TenantAccessEvaluator,
  input: ProvisionTenantWorkflowInput,
): Promise<ProvisionTenantWorkflowResult> {
  const decision = await access.checkPermission({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permissionKey: "tenant.manage_workflows",
  });
  if (!decision.allowed) {
    throw new TenantAuthorizationError(decision.reason);
  }

  const definition = await catalog.getDefinitionBySlug(
    input.workflowDefinitionSlug,
  );
  if (!definition) {
    throw new Error(
      `Cannot provision "${input.workflowDefinitionSlug}": no platform workflow definition found. Run seedPlatformWorkflowCatalog first.`,
    );
  }

  const { rows } = await db.query<TenantWorkflowRow>(
    `insert into tenant_workflows
       (tenant_id, workflow_definition_id, workflow_version_id, enabled)
     values ($1, $2, $3, false)
     on conflict (tenant_id, workflow_definition_id) do nothing
     returning *`,
    [input.tenantId, definition.id, input.workflowVersionId],
  );

  const inserted = rows[0];
  if (inserted) {
    const installation = mapRow(inserted);
    await recordAuditEvent(db, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorType: "user",
      eventType: "tenant_workflow.provisioned",
      resourceType: "tenant_workflows",
      resourceId: installation.id,
      metadata: {
        workflowDefinitionSlug: input.workflowDefinitionSlug,
        workflowVersionId: input.workflowVersionId,
      },
    });
    return { installation, created: true };
  }

  const { rows: existingRows } = await db.query<TenantWorkflowRow>(
    "select * from tenant_workflows where tenant_id = $1 and workflow_definition_id = $2",
    [input.tenantId, definition.id],
  );
  return { installation: mapRow(existingRows[0]!), created: false };
}
