import type { Pool } from "pg";

/**
 * Self-contained copy of packages/shared/test/seedFixtures.ts — see
 * setupTestDb.ts's note on why this is duplicated rather than imported
 * across the package boundary. Keep the two in sync if the fixture shape
 * itself changes. Extends the permKeys list with tenant.manage_workflows
 * and the four Phase 4 governance permission keys (this package's own
 * addition).
 */

export interface CoreFixtures {
  tenantA: string;
  tenantB: string;
  userAOwner: string; // member of tenant A, "owner" role (all tenant.* permissions)
  userAMember: string; // member of tenant A, "member" role (no elevated permissions)
  userADecider: string; // member of tenant A, "approver" role (view/decide approvals only) — a second distinct approver identity for quorum tests
  userB: string; // member of tenant B only, "owner" role there
}

export async function seedCoreFixtures(pool: Pool): Promise<CoreFixtures> {
  const permKeys = [
    "tenant.manage",
    "tenant.manage_members",
    "tenant.manage_roles",
    "tenant.view_audit_log",
    "tenant.view_security_log",
    "tenant.manage_agents",
    "tenant.manage_workflows",
    "tenant.view_approvals",
    "tenant.decide_approvals",
    "tenant.manage_policies",
    "tenant.view_governance_events",
  ];
  for (const key of permKeys) {
    await pool.query(
      "insert into permissions (key, category) values ($1, 'tenant') on conflict (key) do nothing",
      [key],
    );
  }

  const { rows: tenantRows } = await pool.query<{ id: string }>(
    `insert into tenants (name, slug) values ('Tenant A', 'tenant-a'), ('Tenant B', 'tenant-b')
     returning id`,
  );
  const [tenantA, tenantB] = tenantRows.map((r) => r.id) as [string, string];

  const { rows: userRows } = await pool.query<{ id: string }>(
    `insert into auth.users (email) values
       ('a-owner@example.com'), ('a-member@example.com'), ('a-decider@example.com'), ('b@example.com')
     returning id`,
  );
  const [userAOwner, userAMember, userADecider, userB] = userRows.map(
    (r) => r.id,
  ) as [string, string, string, string];

  async function makeRole(
    tenantId: string,
    key: string,
    keys: string[],
  ): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      "insert into roles (tenant_id, key, name) values ($1, $2, $2) returning id",
      [tenantId, key],
    );
    const roleId = rows[0]!.id;
    for (const permKey of keys) {
      await pool.query(
        `insert into role_permissions (role_id, permission_id)
         select $1, id from permissions where key = $2`,
        [roleId, permKey],
      );
    }
    return roleId;
  }

  const ownerRoleA = await makeRole(tenantA, "owner", permKeys);
  const memberRoleA = await makeRole(tenantA, "member", []);
  const approverRoleA = await makeRole(tenantA, "approver", [
    "tenant.view_approvals",
    "tenant.decide_approvals",
  ]);
  const ownerRoleB = await makeRole(tenantB, "owner", permKeys);

  await pool.query(
    "insert into tenant_memberships (tenant_id, user_id, role_id) values ($1, $2, $3)",
    [tenantA, userAOwner, ownerRoleA],
  );
  await pool.query(
    "insert into tenant_memberships (tenant_id, user_id, role_id) values ($1, $2, $3)",
    [tenantA, userAMember, memberRoleA],
  );
  await pool.query(
    "insert into tenant_memberships (tenant_id, user_id, role_id) values ($1, $2, $3)",
    [tenantA, userADecider, approverRoleA],
  );
  await pool.query(
    "insert into tenant_memberships (tenant_id, user_id, role_id) values ($1, $2, $3)",
    [tenantB, userB, ownerRoleB],
  );

  return { tenantA, tenantB, userAOwner, userAMember, userADecider, userB };
}
