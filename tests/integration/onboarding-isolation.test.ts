/**
 * Proves the Phase 3 onboarding schema's RLS
 * (supabase/migrations/20260718000000_onboarding.sql) actually isolates
 * tenants and roles: a session/step/preference row created by one
 * tenant's owner is invisible and unwritable to another tenant's owner,
 * and the designer/production_manager read-only carve-outs don't leak
 * into the owner/admin-only tables (budget, startup-kit recommendation,
 * launch readiness). Requires a live, seeded Supabase project plus
 * SUPABASE_SERVICE_ROLE_KEY (used only to seed/clean up rows, never to
 * perform the isolation checks themselves). Skips — does not pass —
 * without both; see docs/TESTING.md.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ISOLATION_TENANT_ID,
  KUSHPRINTCO_TENANT_ID,
  TEST_USERS,
  hasServiceRole,
  serviceRoleClient,
  signInAs,
} from "./helpers";

describe.skipIf(!hasServiceRole)("onboarding isolation", () => {
  let ownerAProfileId: string;

  beforeAll(async () => {
    const ownerClient = await signInAs(TEST_USERS.ownerA);
    ownerAProfileId = (await ownerClient.auth.getUser()).data.user!.id;
  });

  afterAll(async () => {
    const service = serviceRoleClient();
    for (const table of [
      "onboarding_step_progress",
      "brand_profiles",
      "budget_profiles",
      "startup_kit_recommendations",
      "launch_readiness_assessments",
      "onboarding_sessions",
    ]) {
      await service.from(table).delete().eq("tenant_id", KUSHPRINTCO_TENANT_ID);
    }
  });

  it("lets an owner create their own onboarding session, and re-creating it is idempotent (upsert on tenant_id, not a duplicate row)", async () => {
    const client = await signInAs(TEST_USERS.ownerA);

    const { error: insertError } = await client
      .from("onboarding_sessions")
      .insert({ tenant_id: KUSHPRINTCO_TENANT_ID, started_by: ownerAProfileId });
    expect(insertError).toBeNull();

    // A second "start" is a plain update via upsert semantics in the app
    // layer (lib/onboarding/session.ts); here we confirm the unique
    // constraint on tenant_id is what makes that safe — a second insert
    // must fail, not silently create a duplicate session.
    const { error: duplicateError } = await client
      .from("onboarding_sessions")
      .insert({ tenant_id: KUSHPRINTCO_TENANT_ID, started_by: ownerAProfileId });
    expect(duplicateError).not.toBeNull();

    const { data, error } = await client
      .from("onboarding_sessions")
      .select("id")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("upserting the same step twice updates one row instead of creating a duplicate", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const { data: session } = await client
      .from("onboarding_sessions")
      .select("id")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .single();
    expect(session).not.toBeNull();

    for (const status of ["in_progress", "completed"] as const) {
      const { error } = await client.from("onboarding_step_progress").upsert(
        {
          session_id: session!.id,
          tenant_id: KUSHPRINTCO_TENANT_ID,
          step_key: "welcome",
          status,
        },
        { onConflict: "session_id,step_key" },
      );
      expect(error).toBeNull();
    }

    const { data: rows, error } = await client
      .from("onboarding_step_progress")
      .select("status")
      .eq("session_id", session!.id)
      .eq("step_key", "welcome");
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0].status).toBe("completed");
  });

  it("does not let tenant B's owner read tenant A's onboarding session (cross-tenant denial)", async () => {
    const client = await signInAs(TEST_USERS.ownerB);
    const { data, error } = await client
      .from("onboarding_sessions")
      .select("id")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("does not let tenant B's owner write into tenant A's onboarding session", async () => {
    const client = await signInAs(TEST_USERS.ownerB);
    const ownerBProfileId = (await client.auth.getUser()).data.user!.id;
    const { error } = await client.from("onboarding_sessions").insert({
      tenant_id: KUSHPRINTCO_TENANT_ID,
      started_by: ownerBProfileId,
    });
    expect(error).not.toBeNull();
  });

  it("recommendation persistence: an owner can save a startup-kit recommendation and read it back", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const { data: session } = await client
      .from("onboarding_sessions")
      .select("id")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .single();

    const { error: insertError } = await client.from("startup_kit_recommendations").upsert(
      {
        tenant_id: KUSHPRINTCO_TENANT_ID,
        session_id: session!.id,
        recommended_kit_slug: "dtf-launch-kit",
        score: 90,
        explanation: "test",
        rule_version: "test-version",
      },
      { onConflict: "tenant_id" },
    );
    expect(insertError).toBeNull();

    const { data, error } = await client
      .from("startup_kit_recommendations")
      .select("recommended_kit_slug, overridden")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .single();
    expect(error).toBeNull();
    expect(data?.recommended_kit_slug).toBe("dtf-launch-kit");
    expect(data?.overridden).toBe(false);
  });

  it("a designer cannot read the startup-kit recommendation or budget profile (owner/admin only, no designer carve-out)", async () => {
    const client = await signInAs(TEST_USERS.designerA);

    const { data: recommendation, error: recError } = await client
      .from("startup_kit_recommendations")
      .select("id")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID);
    expect(recError).toBeNull();
    expect(recommendation).toHaveLength(0);

    const { data: budget, error: budgetError } = await client
      .from("budget_profiles")
      .select("id")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID);
    expect(budgetError).toBeNull();
    expect(budget).toHaveLength(0);
  });

  it("a designer has read-only access to brand_profiles — can read, cannot write", async () => {
    const owner = await signInAs(TEST_USERS.ownerA);
    const { data: session } = await owner
      .from("onboarding_sessions")
      .select("id")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .single();
    await owner.from("brand_profiles").upsert(
      { tenant_id: KUSHPRINTCO_TENANT_ID, session_id: session!.id, brand_name: "Test Brand" },
      { onConflict: "tenant_id" },
    );

    const designer = await signInAs(TEST_USERS.designerA);
    const { data, error } = await designer
      .from("brand_profiles")
      .select("brand_name")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .single();
    expect(error).toBeNull();
    expect(data?.brand_name).toBe("Test Brand");

    const { error: writeError } = await designer
      .from("brand_profiles")
      .update({ brand_name: "Hijacked Name" })
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID);
    // RLS blocks the write silently (0 rows affected) rather than
    // returning a Postgres error — assert the value is unchanged.
    const { data: after } = await owner
      .from("brand_profiles")
      .select("brand_name")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .single();
    expect(writeError).toBeNull();
    expect(after?.brand_name).toBe("Test Brand");
  });

  it("a production_manager cannot read launch_readiness_assessments (owner/admin only)", async () => {
    const client = await signInAs(TEST_USERS.productionA);
    const { data, error } = await client
      .from("launch_readiness_assessments")
      .select("id")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("completion is a plain status transition an owner can perform, and tenant B cannot perform on tenant A's session", async () => {
    const owner = await signInAs(TEST_USERS.ownerA);
    const { error: completeError } = await owner
      .from("onboarding_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID);
    expect(completeError).toBeNull();

    const { data } = await owner
      .from("onboarding_sessions")
      .select("status")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .single();
    expect(data?.status).toBe("completed");

    const outsider = await signInAs(TEST_USERS.ownerB);
    const { data: reopened, error: reopenError } = await outsider
      .from("onboarding_sessions")
      .update({ status: "archived" })
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .select("id");
    expect(reopenError).toBeNull();
    expect(reopened).toHaveLength(0);
  });

  it("audit log rows are written for onboarding actions via the service-role client (the one privileged writer for audit_logs)", async () => {
    const service = serviceRoleClient();
    const { error } = await service.from("audit_logs").insert({
      tenant_id: KUSHPRINTCO_TENANT_ID,
      actor_profile_id: ownerAProfileId,
      action: "onboarding.started",
      target_table: "onboarding_sessions",
    });
    expect(error).toBeNull();

    const { data, error: readError } = await service
      .from("audit_logs")
      .select("action")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .eq("action", "onboarding.started");
    expect(readError).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("does not leak tenant A's onboarding rows into tenant B's own (empty) onboarding queries", async () => {
    const client = await signInAs(TEST_USERS.ownerB);
    const { data, error } = await client
      .from("onboarding_sessions")
      .select("id")
      .eq("tenant_id", ISOLATION_TENANT_ID);
    expect(error).toBeNull();
    // Tenant B has no onboarding session seeded — this should be empty,
    // not accidentally populated with tenant A's row under any condition.
    expect(data).toHaveLength(0);
  });
});

describe.skipIf(!hasServiceRole)("brand logo upload authorization", () => {
  const LOGO_PATH = `${KUSHPRINTCO_TENANT_ID}/logo/phase-3-test-logo.png`;
  const TINY_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  afterAll(async () => {
    const service = serviceRoleClient();
    await service.storage.from("logos").remove([LOGO_PATH]);
  });

  it("lets tenant A's owner upload a logo under their own tenant-prefixed path", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const { error } = await client.storage
      .from("logos")
      .upload(LOGO_PATH, TINY_PNG, { contentType: "image/png", upsert: true });
    expect(error).toBeNull();
  });

  it("does not let a designer (not owner/admin) upload a logo for the tenant", async () => {
    const client = await signInAs(TEST_USERS.designerA);
    const { error } = await client.storage
      .from("logos")
      .upload(`${KUSHPRINTCO_TENANT_ID}/logo/designer-attempt.png`, TINY_PNG, {
        contentType: "image/png",
      });
    expect(error).not.toBeNull();
  });

  it("does not let tenant B's owner upload a logo under tenant A's path", async () => {
    const client = await signInAs(TEST_USERS.ownerB);
    const { error } = await client.storage
      .from("logos")
      .upload(`${KUSHPRINTCO_TENANT_ID}/logo/cross-tenant-attempt.png`, TINY_PNG, {
        contentType: "image/png",
      });
    expect(error).not.toBeNull();
  });
});
