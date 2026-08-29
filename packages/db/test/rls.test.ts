import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Pool } from "pg";
import { withAnonContext, withServiceRoleContext, withUserContext } from "../src/client";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

if (!databaseUrl) {
  console.warn("Skipping RLS tests: DATABASE_URL is not set. See packages/db/README.md.");
}

describeIfDb("Row Level Security: multi-tenant isolation", () => {
  const pool = new Pool({ connectionString: databaseUrl });

  const orgA = { id: crypto.randomUUID(), slug: `org-a-${Date.now()}` };
  const orgB = { id: crypto.randomUUID(), slug: `org-b-${Date.now()}` };
  const workspaceA = crypto.randomUUID();
  const workspaceB = crypto.randomUUID();
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  const outsider = crypto.randomUUID();
  const creatorProfileA = crypto.randomUUID();
  const creatorProfileB = crypto.randomUUID();
  const publishedAssetB = crypto.randomUUID();
  const draftAssetB = crypto.randomUUID();

  beforeAll(async () => {
    await withServiceRoleContext(pool, async (client) => {
      await client.query(
        "insert into organizations (id, name, slug) values ($1, 'Org A', $2), ($3, 'Org B', $4)",
        [orgA.id, orgA.slug, orgB.id, orgB.slug],
      );
      await client.query(
        "insert into workspaces (id, organization_id, name) values ($1, $2, 'A workspace'), ($3, $4, 'B workspace')",
        [workspaceA, orgA.id, workspaceB, orgB.id],
      );
      await client.query(
        "insert into organization_members (organization_id, user_id, role) values ($1, $2, 'OWNER'), ($3, $4, 'OWNER')",
        [orgA.id, userA, orgB.id, userB],
      );
      await client.query(
        `insert into creator_profiles (id, organization_id, workspace_id, user_id, display_name, handle)
         values ($1, $2, $3, $4, 'Creator A', $5), ($6, $7, $8, $9, 'Creator B', $10)`,
        [
          creatorProfileA,
          orgA.id,
          workspaceA,
          userA,
          `creator_a_${Date.now()}`,
          creatorProfileB,
          orgB.id,
          workspaceB,
          userB,
          `creator_b_${Date.now()}`,
        ],
      );
      await client.query(
        `insert into assets (id, organization_id, workspace_id, creator_id, type, title, status, source)
         values ($1, $2, $3, $4, 'MUSIC_TRACK', 'Published in B', 'PUBLISHED', 'AI_GENERATED'),
                ($5, $2, $3, $4, 'MUSIC_TRACK', 'Draft in B', 'DRAFT', 'AI_GENERATED')`,
        [publishedAssetB, orgB.id, workspaceB, creatorProfileB, draftAssetB],
      );
    });
  });

  afterAll(async () => {
    await withServiceRoleContext(pool, async (client) => {
      await client.query("delete from organizations where id in ($1, $2)", [orgA.id, orgB.id]);
    });
    await pool.end();
  });

  test("a member sees their own organization but not another tenant's", async () => {
    const seenByA = await withUserContext(pool, userA, (c) => c.query("select id from organizations"));
    expect(seenByA.rows.map((r) => r.id)).toContain(orgA.id);
    expect(seenByA.rows.map((r) => r.id)).not.toContain(orgB.id);
  });

  test("a member sees their own workspaces but not another tenant's", async () => {
    const seenByA = await withUserContext(pool, userA, (c) => c.query("select id from workspaces"));
    expect(seenByA.rows.map((r) => r.id)).toContain(workspaceA);
    expect(seenByA.rows.map((r) => r.id)).not.toContain(workspaceB);
  });

  test("a member sees their own creator profile but not another tenant's", async () => {
    const seenByA = await withUserContext(pool, userA, (c) => c.query("select id from creator_profiles"));
    expect(seenByA.rows.map((r) => r.id)).toContain(creatorProfileA);
    expect(seenByA.rows.map((r) => r.id)).not.toContain(creatorProfileB);
  });

  test("an outsider with no membership sees no organizations at all", async () => {
    const seen = await withUserContext(pool, outsider, (c) => c.query("select id from organizations"));
    expect(seen.rows).toHaveLength(0);
  });

  test("a member cannot insert a workspace into a tenant they don't belong to", async () => {
    await expect(
      withUserContext(pool, userA, (c) =>
        c.query("insert into workspaces (organization_id, name) values ($1, 'hostile workspace')", [
          orgB.id,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  test("a member cannot insert a creator profile into another tenant", async () => {
    await expect(
      withUserContext(pool, userA, (c) =>
        c.query(
          `insert into creator_profiles (organization_id, workspace_id, user_id, display_name, handle)
           values ($1, $2, $3, 'Intruder', $4)`,
          [orgB.id, workspaceB, userA, `intruder_${Date.now()}`],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  test("published assets are publicly readable by anon, drafts are not", async () => {
    const seenByAnon = await withAnonContext(pool, (c) => c.query("select id, status from assets"));
    const ids = seenByAnon.rows.map((r) => r.id);
    expect(ids).toContain(publishedAssetB);
    expect(ids).not.toContain(draftAssetB);
  });

  test("public_creator_profiles exposes only safe fields, readable by anon", async () => {
    const seenByAnon = await withAnonContext(pool, (c) =>
      c.query("select * from public_creator_profiles where id = $1", [creatorProfileB]),
    );
    expect(seenByAnon.rows).toHaveLength(1);
    const row = seenByAnon.rows[0];
    expect(row.display_name).toBe("Creator B");
    expect(row.flowra_pay_account_id).toBeUndefined();
    expect(row.onboarding_step).toBeUndefined();

    // The base table itself still has no anon policy at all.
    const baseTableSeenByAnon = await withAnonContext(pool, (c) =>
      c.query("select id from creator_profiles where id = $1", [creatorProfileB]),
    );
    expect(baseTableSeenByAnon.rows).toHaveLength(0);
  });

  test("draft assets are visible to the owning tenant's members", async () => {
    const seenByB = await withUserContext(pool, userB, (c) => c.query("select id from assets"));
    expect(seenByB.rows.map((r) => r.id)).toContain(draftAssetB);
  });

  test("an unaffiliated authenticated user cannot see another tenant's draft assets", async () => {
    const seenByOutsider = await withUserContext(pool, outsider, (c) => c.query("select id from assets where status = 'DRAFT'"));
    expect(seenByOutsider.rows.map((r) => r.id)).not.toContain(draftAssetB);
  });

  test("financial tables have no authenticated write path: order inserts are rejected", async () => {
    await expect(
      withUserContext(pool, userB, (c) =>
        c.query(
          `insert into orders (organization_id, workspace_id, product_id, creator_id, fan_id, fan_display_name, status, gross_amount_minor_units, gross_currency, idempotency_key)
           values ($1, $2, gen_random_uuid(), $3, $4, 'Sneaky Fan', 'COMPLETED', 999999, 'USD', 'hostile-key')`,
          [orgB.id, workspaceB, creatorProfileB, outsider],
        ),
      ),
    ).rejects.toThrow(/row-level security|permission denied/i);
  });

  test("financial tables have no authenticated write path: ledger entry inserts are rejected", async () => {
    await expect(
      withUserContext(pool, userB, (c) =>
        c.query(
          `insert into ledger_entries (organization_id, transaction_id, account_type, account_ref_id, entry_type, direction, amount_minor_units, currency, idempotency_key)
           values ($1, gen_random_uuid(), 'CREATOR_BALANCE', $2, 'CREATOR_NET', 'CREDIT', 100000, 'USD', 'hostile-ledger-key')`,
          [orgB.id, creatorProfileB],
        ),
      ),
    ).rejects.toThrow(/row-level security|permission denied/i);
  });

  test("the service role bypasses RLS to write financial records", async () => {
    const result = await withServiceRoleContext(pool, (c) =>
      c.query(
        `insert into ledger_entries (organization_id, transaction_id, account_type, account_ref_id, entry_type, direction, amount_minor_units, currency, idempotency_key)
         values ($1, gen_random_uuid(), 'CREATOR_BALANCE', $2, 'CREATOR_NET', 'CREDIT', 100000, 'USD', $3) returning id`,
        [orgB.id, creatorProfileB, `service-role-key-${Date.now()}`],
      ),
    );
    expect(result.rows).toHaveLength(1);
  });

  test("consent records are hidden from non-admin org members who aren't the subject", async () => {
    const subject = crypto.randomUUID();
    await withServiceRoleContext(pool, (c) =>
      c.query(
        `insert into consent_records (organization_id, subject_type, subject_user_id, granted_by_user_id, scope)
         values ($1, 'VOICE', $2, $3, 'ORGANIZATION_ONLY')`,
        [orgB.id, subject, userB],
      ),
    );
    // userB is an OWNER (admin), so they should see it.
    const seenByAdmin = await withUserContext(pool, userB, (c) =>
      c.query("select subject_user_id from consent_records where organization_id = $1", [orgB.id]),
    );
    expect(seenByAdmin.rows.map((r) => r.subject_user_id)).toContain(subject);

    // An unrelated authenticated user who is neither the subject nor an admin sees nothing.
    const seenByOutsider = await withUserContext(pool, outsider, (c) =>
      c.query("select subject_user_id from consent_records where organization_id = $1", [orgB.id]),
    );
    expect(seenByOutsider.rows).toHaveLength(0);

    // The subject themselves can see the consent record about them.
    const seenBySubject = await withUserContext(pool, subject, (c) =>
      c.query("select subject_user_id from consent_records where organization_id = $1", [orgB.id]),
    );
    expect(seenBySubject.rows.map((r) => r.subject_user_id)).toContain(subject);
  });
});
