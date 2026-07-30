import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { PgStepLeasing } from "../src/stepLeasing.js";
import type { RetryPolicy } from "../src/manifest.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_workflow_engine";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const leasing = new PgStepLeasing(pool);

let fixtures: CoreFixtures;
let runId: string;

const RETRY_POLICY: RetryPolicy = {
  maxAttempts: 2,
  backoff: "fixed",
  backoffMs: 1000,
  timeoutMs: 60000,
  deadLetterOnExhaustion: true,
};

async function insertReadyStep(stepKey: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `insert into workflow_steps (tenant_id, workflow_run_id, step_key, agent_slug, status, timeout_ms)
     values ($1, $2, $3, 'sara', 'READY', 60000)
     returning id`,
    [fixtures.tenantA, runId, stepKey],
  );
  return rows[0]!.id;
}

beforeAll(async () => {
  await resetAndMigrate(pool);
  fixtures = await seedCoreFixtures(pool);

  const { rows: defRows } = await pool.query<{ id: string }>(
    `insert into workflow_definitions (slug, display_name, description) values ('leasing_test', 'x', 'x') returning id`,
  );
  const { rows: versionRows } = await pool.query<{ id: string }>(
    `insert into workflow_versions (workflow_definition_id, version, manifest, manifest_hash, status)
     values ($1, '1.0.0', '{}'::jsonb, 'hash', 'published') returning id`,
    [defRows[0]!.id],
  );
  const { rows: twRows } = await pool.query<{ id: string }>(
    `insert into tenant_workflows (tenant_id, workflow_definition_id, workflow_version_id)
     values ($1, $2, $3) returning id`,
    [fixtures.tenantA, defRows[0]!.id, versionRows[0]!.id],
  );
  const { rows: runRows } = await pool.query<{ id: string }>(
    `insert into workflow_runs (tenant_id, tenant_workflow_id, workflow_version_id, trace_id)
     values ($1, $2, $3, 'trace-leasing') returning id`,
    [fixtures.tenantA, twRows[0]!.id, versionRows[0]!.id],
  );
  runId = runRows[0]!.id;
});

afterAll(async () => {
  await pool.end();
});

describe("claimStep", () => {
  it("claims a READY step and transitions it to LEASED", async () => {
    const stepId = await insertReadyStep("claim_1");
    const claim = await leasing.claimStep(stepId, "worker-a", 30000);
    expect(claim).not.toBeNull();

    const { rows } = await pool.query(
      "select status from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("LEASED");
  });

  it("returns null when the step is not READY", async () => {
    const stepId = await insertReadyStep("claim_2");
    await leasing.claimStep(stepId, "worker-a", 30000);

    const secondClaim = await leasing.claimStep(stepId, "worker-b", 30000);
    expect(secondClaim).toBeNull();
  });

  it("exactly one of two concurrent claim attempts on the same step succeeds", async () => {
    const stepId = await insertReadyStep("claim_race");
    const [a, b] = await Promise.all([
      leasing.claimStep(stepId, "worker-a", 30000),
      leasing.claimStep(stepId, "worker-b", 30000),
    ]);
    const successes = [a, b].filter((r) => r !== null);
    expect(successes).toHaveLength(1);
  });
});

describe("markStepRunning / renewLease", () => {
  it("transitions LEASED -> RUNNING only for the correct lease token", async () => {
    const stepId = await insertReadyStep("running_1");
    const claim = await leasing.claimStep(stepId, "worker-a", 30000);
    const ok = await leasing.markStepRunning(stepId, claim!.leaseToken);
    expect(ok).toBe(true);

    const { rows } = await pool.query(
      "select status from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("RUNNING");
  });

  it("renews the lease only for the correct token, on a RUNNING step", async () => {
    const stepId = await insertReadyStep("renew_1");
    const claim = await leasing.claimStep(stepId, "worker-a", 30000);
    await leasing.markStepRunning(stepId, claim!.leaseToken);

    const renewed = await leasing.renewLease(stepId, claim!.leaseToken, 60000);
    expect(renewed).toBe(true);

    const badRenew = await leasing.renewLease(
      stepId,
      "00000000-0000-0000-0000-000000000000",
      60000,
    );
    expect(badRenew).toBe(false);
  });
});

describe("commitStepSuccess", () => {
  it("commits success only for the correct lease token", async () => {
    const stepId = await insertReadyStep("success_1");
    const claim = await leasing.claimStep(stepId, "worker-a", 30000);
    await leasing.markStepRunning(stepId, claim!.leaseToken);

    const committed = await leasing.commitStepSuccess(
      stepId,
      claim!.leaseToken,
      { ok: true },
    );
    expect(committed).toBe(true);

    const { rows } = await pool.query(
      "select status, output from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("SUCCEEDED");
    expect(rows[0]!.output).toEqual({ ok: true });
  });

  it("rejects a stale/invalid lease token — affects zero rows", async () => {
    const stepId = await insertReadyStep("success_stale");
    const claim = await leasing.claimStep(stepId, "worker-a", 30000);
    await leasing.markStepRunning(stepId, claim!.leaseToken);

    const committed = await leasing.commitStepSuccess(
      stepId,
      "00000000-0000-0000-0000-000000000000",
      { ok: true },
    );
    expect(committed).toBe(false);

    const { rows } = await pool.query(
      "select status from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("RUNNING");
  });
});

describe("commitStepFailure", () => {
  it("schedules a retry when the error is retryable and attempts remain", async () => {
    const stepId = await insertReadyStep("retry_1");
    const claim = await leasing.claimStep(stepId, "worker-a", 30000);
    await leasing.markStepRunning(stepId, claim!.leaseToken);

    const committed = await leasing.commitStepFailure(
      stepId,
      claim!.leaseToken,
      { retryable: true, code: "transient", message: "oops" },
      RETRY_POLICY,
    );
    expect(committed).toBe(true);

    const { rows } = await pool.query(
      "select status, attempt, next_attempt_at from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("RETRY_SCHEDULED");
    expect(rows[0]!.attempt).toBe(1);
    expect(rows[0]!.next_attempt_at).not.toBeNull();
  });

  it("dead-letters once max attempts are exhausted, and inserts a workflow_dead_letters row", async () => {
    const stepId = await insertReadyStep("deadletter_1");
    await pool.query("update workflow_steps set attempt = 1 where id = $1", [
      stepId,
    ]);
    const claim = await leasing.claimStep(stepId, "worker-a", 30000);
    await leasing.markStepRunning(stepId, claim!.leaseToken);

    const committed = await leasing.commitStepFailure(
      stepId,
      claim!.leaseToken,
      { retryable: true, code: "transient", message: "oops again" },
      RETRY_POLICY, // maxAttempts: 2, attempt was 1 -> nextAttempt 2 -> exhausted
    );
    expect(committed).toBe(true);

    const { rows } = await pool.query(
      "select status from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("DEAD_LETTERED");

    const { rows: deadLetters } = await pool.query(
      "select attempt_count, reason from workflow_dead_letters where workflow_step_id = $1",
      [stepId],
    );
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0]!.attempt_count).toBe(2);
  });

  it("fails (no dead letter row) for a non-retryable error when deadLetterOnExhaustion is false", async () => {
    const stepId = await insertReadyStep("fail_1");
    const claim = await leasing.claimStep(stepId, "worker-a", 30000);
    await leasing.markStepRunning(stepId, claim!.leaseToken);

    const committed = await leasing.commitStepFailure(
      stepId,
      claim!.leaseToken,
      { retryable: false, code: "validation", message: "bad input" },
      { ...RETRY_POLICY, deadLetterOnExhaustion: false },
    );
    expect(committed).toBe(true);

    const { rows } = await pool.query(
      "select status from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("FAILED");

    const { rows: deadLetters } = await pool.query(
      "select 1 from workflow_dead_letters where workflow_step_id = $1",
      [stepId],
    );
    expect(deadLetters).toHaveLength(0);
  });

  it("rejects a stale lease token — affects zero rows, no dead letter written", async () => {
    const stepId = await insertReadyStep("stale_failure");
    const claim = await leasing.claimStep(stepId, "worker-a", 30000);
    await leasing.markStepRunning(stepId, claim!.leaseToken);

    const committed = await leasing.commitStepFailure(
      stepId,
      "00000000-0000-0000-0000-000000000000",
      { retryable: false, code: "x", message: "x" },
      RETRY_POLICY,
    );
    expect(committed).toBe(false);

    const { rows } = await pool.query(
      "select status from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("RUNNING");
  });
});
