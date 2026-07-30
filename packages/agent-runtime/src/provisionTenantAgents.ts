import type { Queryable, TenantAccessEvaluator } from "@repo/shared";
import { TenantAuthorizationError, recordAuditEvent } from "@repo/shared";
import type { PlatformAgentCatalog } from "./platformCatalog.js";
import type { TenantAgentInstallation } from "./tenantAgentRegistry.js";
import type { CanonicalAgentSlug } from "./agents/index.js";
import { CANONICAL_AGENT_SLUGS } from "./agents/index.js";

export interface ProvisionTenantAgentsInput {
  tenantId: string;
  actorUserId: string;
  /**
   * Explicit per-agent version to install — never resolved implicitly to
   * "whatever is currently published." Callers that want "the current
   * published version" must resolve it themselves (e.g. via
   * `PlatformAgentCatalog.listPublishedVersions`) and pass the result here.
   */
  versionsBySlug: Record<CanonicalAgentSlug, string>;
}

export interface ProvisionTenantAgentsResult {
  created: TenantAgentInstallation[];
  skipped: CanonicalAgentSlug[];
}

type TenantAgentRow = {
  id: string;
  tenant_id: string;
  agent_definition_id: string;
  agent_version_id: string;
  display_name_override: string | null;
  lifecycle_status: TenantAgentInstallation["lifecycleStatus"];
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

/**
 * Idempotent, explicit provisioning of the six canonical agents for a
 * tenant — deliberately a plain application function, not a database
 * trigger (`ADR-0013` addendum). Creates missing installations only,
 * defaults every new one to `REGISTERED`/disabled, and records one audit
 * event per installation actually created (not for ones already present).
 */
export async function provisionTenantAgents(
  db: Queryable,
  catalog: PlatformAgentCatalog,
  access: TenantAccessEvaluator,
  input: ProvisionTenantAgentsInput,
): Promise<ProvisionTenantAgentsResult> {
  const decision = await access.checkPermission({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permissionKey: "tenant.manage_agents",
  });
  if (!decision.allowed) {
    throw new TenantAuthorizationError(decision.reason);
  }

  const created: TenantAgentInstallation[] = [];
  const skipped: CanonicalAgentSlug[] = [];

  for (const slug of CANONICAL_AGENT_SLUGS) {
    const definition = await catalog.getDefinitionBySlug(slug);
    if (!definition) {
      throw new Error(
        `Cannot provision "${slug}": no platform agent definition found. Run seedPlatformAgentCatalog first.`,
      );
    }
    const agentVersionId = input.versionsBySlug[slug];

    const { rows } = await db.query<TenantAgentRow>(
      `insert into tenant_agents
         (tenant_id, agent_definition_id, agent_version_id, lifecycle_status, enabled)
       values ($1, $2, $3, 'REGISTERED', false)
       on conflict (tenant_id, agent_definition_id) do nothing
       returning *`,
      [input.tenantId, definition.id, agentVersionId],
    );

    const row = rows[0];
    if (!row) {
      skipped.push(slug);
      continue;
    }

    const installation = mapRow(row);
    created.push(installation);

    await recordAuditEvent(db, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorType: "user",
      eventType: "tenant_agent.provisioned",
      resourceType: "tenant_agents",
      resourceId: installation.id,
      metadata: { slug, agentVersionId },
    });
  }

  return { created, skipped };
}
