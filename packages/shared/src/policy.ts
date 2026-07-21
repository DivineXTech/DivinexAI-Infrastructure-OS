import type { Queryable } from "./db.js";

/**
 * Deterministic policy decision — never produced by a model. Per the source
 * brief's rule #14 (prefer deterministic engines for permissions, policy
 * decisions; use AI for interpretation and generation, not access control),
 * every evaluator in this file is plain SQL logic with no AI involvement.
 */
export type PolicyDecision = { allowed: true } | { allowed: false; reason: string };

export interface MembershipCheckInput {
  tenantId: string;
  userId: string;
}

export interface PermissionCheckInput extends MembershipCheckInput {
  permissionKey: string;
}

/**
 * Contract for tenant membership/permission checks, independent of how the
 * underlying data is reached (direct Postgres here; a future implementation
 * could wrap `@supabase/supabase-js` instead without changing this
 * interface's callers).
 */
export interface TenantAccessEvaluator {
  checkMembership(input: MembershipCheckInput): Promise<PolicyDecision>;
  checkPermission(input: PermissionCheckInput): Promise<PolicyDecision>;
}

/**
 * Reference implementation, backed by direct SQL against the same tables
 * the RLS policies in `supabase/migrations/20260721000001_core_tenancy.sql`
 * use. This does not rely on RLS to be correct — it is meant for
 * service-role-equivalent code paths that bypass RLS entirely (rule #8:
 * never trust a client-supplied tenant ID; a background job or workflow
 * step must run this explicitly). When the caller's `db` connection *is*
 * subject to RLS (e.g. the restricted `authenticated` role), both layers
 * agree by construction, since they encode the same rule.
 */
export class PgTenantAccessEvaluator implements TenantAccessEvaluator {
  constructor(private readonly db: Queryable) {}

  async checkMembership({ tenantId, userId }: MembershipCheckInput): Promise<PolicyDecision> {
    const { rows } = await this.db.query(
      `select 1
       from tenant_memberships
       where tenant_id = $1 and user_id = $2 and status = 'active'
       limit 1`,
      [tenantId, userId],
    );
    return rows.length > 0
      ? { allowed: true }
      : { allowed: false, reason: "not_an_active_tenant_member" };
  }

  async checkPermission(input: PermissionCheckInput): Promise<PolicyDecision> {
    const membership = await this.checkMembership(input);
    if (!membership.allowed) return membership;

    const { rows } = await this.db.query(
      `select 1
       from tenant_memberships m
       join role_permissions rp on rp.role_id = m.role_id
       join permissions p on p.id = rp.permission_id
       where m.tenant_id = $1 and m.user_id = $2 and m.status = 'active' and p.key = $3
       limit 1`,
      [input.tenantId, input.userId, input.permissionKey],
    );
    return rows.length > 0
      ? { allowed: true }
      : { allowed: false, reason: `missing_permission:${input.permissionKey}` };
  }
}
