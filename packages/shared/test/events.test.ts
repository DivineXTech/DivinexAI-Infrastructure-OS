import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { asUser, resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { recordAuditEvent, recordSecurityEvent } from "../src/events.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test";
const TEST_DATABASE_URL_AUTHENTICATED =
  process.env.TEST_DATABASE_URL_AUTHENTICATED ??
  "postgres://authenticated:authenticated@127.0.0.1:5432/agentflow_test";

const ownerPool = new Pool({ connectionString: TEST_DATABASE_URL });
const authPool = new Pool({ connectionString: TEST_DATABASE_URL_AUTHENTICATED });

let fixtures: CoreFixtures;

beforeAll(async () => {
  await resetAndMigrate(ownerPool);
  fixtures = await seedCoreFixtures(ownerPool);
});

afterAll(async () => {
  await ownerPool.end();
  await authPool.end();
});

describe("audit_events / security_events", () => {
  it("recordAuditEvent succeeds via a service-role-equivalent (owner) connection", async () => {
    await recordAuditEvent(ownerPool, {
      tenantId: fixtures.tenantA,
      actorUserId: fixtures.userAOwner,
      actorType: "user",
      eventType: "tenant_settings.updated",
      resourceType: "tenant_settings",
      resourceId: fixtures.tenantA,
      metadata: { keys: ["theme"] },
    });

    const { rows } = await ownerPool.query(
      "select event_type, tenant_id from audit_events where tenant_id = $1",
      [fixtures.tenantA],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.event_type).toBe("tenant_settings.updated");
  });

  it("recordSecurityEvent succeeds via a service-role-equivalent (owner) connection", async () => {
    await recordSecurityEvent(ownerPool, {
      tenantId: fixtures.tenantA,
      actorUserId: fixtures.userAOwner,
      severity: "warning",
      eventType: "cross_tenant_access_denied",
      description: "Attempted write to another tenant's settings",
    });

    const { rows } = await ownerPool.query(
      "select severity from security_events where tenant_id = $1",
      [fixtures.tenantA],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.severity).toBe("warning");
  });

  it("a normal authenticated user cannot insert an audit event directly, even for their own tenant (integrity)", async () => {
    await expect(
      asUser(authPool, fixtures.userAOwner, async (client) =>
        client.query(
          `insert into audit_events (tenant_id, actor_user_id, actor_type, event_type)
           values ($1, $2, 'user', 'fabricated_event')`,
          [fixtures.tenantA, fixtures.userAOwner],
        ),
      ),
    ).rejects.toThrow();
  });

  it("a normal authenticated user cannot insert a security event directly, even for their own tenant (integrity)", async () => {
    await expect(
      asUser(authPool, fixtures.userAOwner, async (client) =>
        client.query(
          `insert into security_events (tenant_id, actor_user_id, severity, event_type, description)
           values ($1, $2, 'critical', 'fabricated_event', 'should not be allowed')`,
          [fixtures.tenantA, fixtures.userAOwner],
        ),
      ),
    ).rejects.toThrow();
  });

  it("a member WITH tenant.view_audit_log can read their tenant's audit events", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query("select tenant_id from audit_events where tenant_id = $1", [
        fixtures.tenantA,
      ]);
      return res.rows;
    });
    expect(rows).toHaveLength(1);
  });

  it("a member WITHOUT tenant.view_audit_log cannot read the tenant's audit events", async () => {
    const rows = await asUser(authPool, fixtures.userAMember, async (client) => {
      const res = await client.query("select tenant_id from audit_events where tenant_id = $1", [
        fixtures.tenantA,
      ]);
      return res.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it("a member of a different tenant cannot read tenant A's audit events even with the same permission elsewhere", async () => {
    const rows = await asUser(authPool, fixtures.userB, async (client) => {
      const res = await client.query("select tenant_id from audit_events where tenant_id = $1", [
        fixtures.tenantA,
      ]);
      return res.rows;
    });
    expect(rows).toHaveLength(0);
  });
});
