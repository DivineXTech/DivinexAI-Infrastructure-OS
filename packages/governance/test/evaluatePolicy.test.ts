import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformPolicyCatalog, type PolicySeed } from "../src/seedPlatformPolicyCatalog.js";
import { seedPlatformRiskClassificationCatalog } from "../src/seedPlatformRiskClassificationCatalog.js";
import { PgPlatformPolicyCatalog } from "../src/platformPolicyCatalog.js";
import { PgPlatformRiskClassificationCatalog } from "../src/platformRiskClassificationCatalog.js";
import { PgTenantPolicyRegistry } from "../src/tenantPolicyRegistry.js";
import { provisionTenantPolicy, createTenantPolicyOverride } from "../src/provisionTenantPolicy.js";
import { evaluatePolicy } from "../src/evaluatePolicy.js";
import type { PolicyEffect, RiskLevel } from "../src/policyDocument.js";
import { PgTenantAccessEvaluator } from "@repo/shared";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_governance";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const policyCatalog = new PgPlatformPolicyCatalog(pool);
const riskCatalog = new PgPlatformRiskClassificationCatalog(pool);
const registry = new PgTenantPolicyRegistry(pool);
const access = new PgTenantAccessEvaluator(pool);

let fixtures: CoreFixtures;
let seedCounter = 0;

async function seedUnconditionalPolicy(
  action: string,
  effect: PolicyEffect,
  opts: Partial<PolicySeed> = {},
): Promise<{ policyDefinitionId: string; policyVersionId: string }> {
  seedCounter += 1;
  const slug = `policy-${action}-${effect}-${seedCounter}`;
  const seed: PolicySeed = {
    slug,
    displayName: slug,
    description: "test policy",
    version: "1.0.0",
    document: {
      appliesToActions: [action as never],
      conditions: { field: "action", operator: "eq", value: action },
      effect,
      riskLevel: null,
      requiredPermissions: [],
      requiredApproverRoles: [],
      requiredApprovalCount: 1,
      rejectOnFirstRejection: true,
      approvalExpirationMs: null,
    },
    priority: 100,
    mandatory: false,
    overridePolicy: "overridable",
    ...opts,
  };
  await seedPlatformPolicyCatalog(pool, [seed]);
  const definition = await policyCatalog.getDefinitionBySlug(slug);
  const [version] = await policyCatalog.listPublishedVersions(definition!.id);
  return { policyDefinitionId: definition!.id, policyVersionId: version!.id };
}

async function seedRiskFloor(action: string, riskLevel: RiskLevel): Promise<void> {
  await seedPlatformRiskClassificationCatalog(pool, [
    { action, version: "1.0.0", riskLevel, rationale: "test" },
  ]);
}

beforeAll(async () => {
  await resetAndMigrate(pool);
  fixtures = await seedCoreFixtures(pool);
  await seedRiskFloor("*", "LOW");
});

afterAll(async () => {
  await pool.end();
});

function baseContext(action: string, overrides: Partial<Parameters<typeof evaluatePolicy>[4]> = {}) {
  return {
    tenantId: fixtures.tenantA,
    action,
    parameters: {},
    targetResource: null,
    actorType: "worker" as const,
    actorId: "test-worker",
    traceId: `trace-${action}`,
    correlationId: `corr-${action}`,
    ...overrides,
  };
}

describe("evaluatePolicy — no matching policy", () => {
  it("resolves to ALLOW when nothing matches", async () => {
    const decision = await evaluatePolicy(
      pool,
      policyCatalog,
      riskCatalog,
      registry,
      baseContext("agent.activate"),
    );
    expect(decision.effect).toBe("ALLOW");
    expect(decision.riskLevel).toBe("LOW");
    expect(decision.requiredApprovalCount).toBe(0);
  });
});

describe("evaluatePolicy — determinism", () => {
  it("identical inputs produce an identical decision content across repeated calls", async () => {
    await seedUnconditionalPolicy("data.export", "REQUIRE_APPROVAL");
    const a = await evaluatePolicy(pool, policyCatalog, riskCatalog, registry, baseContext("data.export"));
    const b = await evaluatePolicy(pool, policyCatalog, riskCatalog, registry, baseContext("data.export"));
    expect(a.effect).toBe(b.effect);
    expect(a.riskLevel).toBe(b.riskLevel);
    expect(a.requiredApprovalCount).toBe(b.requiredApprovalCount);
    expect(a.evaluatedPolicyVersionIds).toEqual(b.evaluatedPolicyVersionIds);
    expect(a.riskClassificationVersionId).toBe(b.riskClassificationVersionId);
  });
});

describe("evaluatePolicy — platform mandatory precedence", () => {
  it("a mandatory BLOCK survives regardless of tenant assignment disabling it", async () => {
    const { policyDefinitionId } = await seedUnconditionalPolicy("data.delete", "BLOCK", {
      mandatory: true,
      overridePolicy: "immutable",
    });
    // Tenant attempts to disable it — has no effect on a mandatory policy.
    const { rows } = await pool.query<{ id: string }>(
      "select id from policy_versions where policy_definition_id = $1",
      [policyDefinitionId],
    );
    await provisionTenantPolicy(pool, access, {
      tenantId: fixtures.tenantA,
      actorUserId: fixtures.userAOwner,
      policyDefinitionId,
      policyVersionId: rows[0]!.id,
      enabled: false,
    });

    const decision = await evaluatePolicy(
      pool,
      policyCatalog,
      riskCatalog,
      registry,
      baseContext("data.delete"),
    );
    expect(decision.effect).toBe("BLOCK");
  });
});

describe("evaluatePolicy — tenant opt-out of a non-mandatory default", () => {
  it("absence of an assignment row means default-on", async () => {
    await seedUnconditionalPolicy("refund.issue", "REQUIRE_APPROVAL", { mandatory: false });
    const decision = await evaluatePolicy(
      pool,
      policyCatalog,
      riskCatalog,
      registry,
      baseContext("refund.issue"),
    );
    expect(decision.effect).toBe("REQUIRE_APPROVAL");
  });

  it("an explicit disabling assignment excludes a non-mandatory policy", async () => {
    const { policyDefinitionId, policyVersionId } = await seedUnconditionalPolicy(
      "payout.initiate",
      "REQUIRE_APPROVAL",
      { mandatory: false },
    );
    await provisionTenantPolicy(pool, access, {
      tenantId: fixtures.tenantA,
      actorUserId: fixtures.userAOwner,
      policyDefinitionId,
      policyVersionId,
      enabled: false,
    });
    const decision = await evaluatePolicy(
      pool,
      policyCatalog,
      riskCatalog,
      registry,
      baseContext("payout.initiate"),
    );
    expect(decision.effect).toBe("ALLOW");
  });
});

describe("evaluatePolicy — deterministic conflict resolution at every precedence level", () => {
  const cases: [string, PolicyEffect, PolicyEffect, PolicyEffect][] = [
    ["code.deploy.production", "BLOCK", "ALLOW", "BLOCK"],
    ["contract.commit", "BLOCK", "DENY", "BLOCK"],
    ["database.execute.destructive", "DENY", "ESCALATE", "DENY"],
    ["security.policy.modify", "DENY", "REQUIRE_APPROVAL", "DENY"],
    ["permission.modify", "DENY", "ALLOW", "DENY"],
    ["secret.access", "ESCALATE", "REQUIRE_APPROVAL", "ESCALATE"],
    ["secret.rotate", "ESCALATE", "ALLOW", "ESCALATE"],
    ["content.publish.external", "REQUIRE_APPROVAL", "ALLOW", "REQUIRE_APPROVAL"],
  ];

  it.each(cases)(
    "action=%s: %s + %s -> %s",
    async (action, effectA, effectB, expected) => {
      await seedUnconditionalPolicy(action, effectA);
      await seedUnconditionalPolicy(action, effectB);
      const decision = await evaluatePolicy(
        pool,
        policyCatalog,
        riskCatalog,
        registry,
        baseContext(action),
      );
      expect(decision.effect).toBe(expected);
    },
  );
});

describe("evaluatePolicy — risk classification floor and policy-asserted raise", () => {
  it("the classification version is the floor; a policy assertion raises it via max(), never lowers it", async () => {
    await seedRiskFloor("pricing.modify", "MEDIUM");
    await seedUnconditionalPolicy("pricing.modify", "REQUIRE_APPROVAL", {
      document: {
        appliesToActions: ["pricing.modify"],
        conditions: { field: "action", operator: "eq", value: "pricing.modify" },
        effect: "REQUIRE_APPROVAL",
        riskLevel: "LOW", // attempts to assert LOWER than the MEDIUM floor
        requiredPermissions: [],
        requiredApproverRoles: [],
        requiredApprovalCount: 1,
        rejectOnFirstRejection: true,
        approvalExpirationMs: null,
      },
    });
    const decision = await evaluatePolicy(
      pool,
      policyCatalog,
      riskCatalog,
      registry,
      baseContext("pricing.modify"),
    );
    // max(MEDIUM floor, LOW assertion) = MEDIUM — never lowered.
    expect(decision.riskLevel).toBe("MEDIUM");
  });

  it("a policy assertion above the floor raises the merged risk level", async () => {
    await seedRiskFloor("billing.modify", "LOW");
    await seedUnconditionalPolicy("billing.modify", "REQUIRE_APPROVAL", {
      document: {
        appliesToActions: ["billing.modify"],
        conditions: { field: "action", operator: "eq", value: "billing.modify" },
        effect: "REQUIRE_APPROVAL",
        riskLevel: "CRITICAL",
        requiredPermissions: [],
        requiredApproverRoles: [],
        requiredApprovalCount: 1,
        rejectOnFirstRejection: true,
        approvalExpirationMs: null,
      },
    });
    const decision = await evaluatePolicy(
      pool,
      policyCatalog,
      riskCatalog,
      registry,
      baseContext("billing.modify"),
    );
    expect(decision.riskLevel).toBe("CRITICAL");
  });

  it("records the exact risk-classification version consulted on the persisted policy_evaluations row", async () => {
    const decision = await evaluatePolicy(
      pool,
      policyCatalog,
      riskCatalog,
      registry,
      baseContext("agent.permission.modify"),
    );
    const { rows } = await pool.query<{ risk_classification_version_id: string }>(
      "select risk_classification_version_id from policy_evaluations where id = $1",
      [decision.id],
    );
    expect(rows[0]!.risk_classification_version_id).toBe(
      decision.riskClassificationVersionId,
    );
  });
});

describe("evaluatePolicy — tenant override restrictions (tier 4)", () => {
  it("an override on an immutable policy version is rejected at write time", async () => {
    const { policyVersionId } = await seedUnconditionalPolicy(
      "code.deploy.production",
      "REQUIRE_APPROVAL",
      { overridePolicy: "immutable" },
    );
    await expect(
      createTenantPolicyOverride(pool, policyCatalog, access, {
        tenantId: fixtures.tenantA,
        actorUserId: fixtures.userAOwner,
        policyVersionId,
        override: {
          additionalRequiredApprovalCount: 1,
          additionalRequiredApproverRoles: [],
          additionalRequiredPermissions: [],
          tightenedConditions: null,
        },
      }),
    ).rejects.toThrow(/override_policy = 'immutable'/);
  });

  it("an override can only tighten (add approval count, never remove a requirement)", async () => {
    const { policyVersionId } = await seedUnconditionalPolicy(
      "workflow.override",
      "REQUIRE_APPROVAL",
      { overridePolicy: "overridable" },
    );
    await createTenantPolicyOverride(pool, policyCatalog, access, {
      tenantId: fixtures.tenantB,
      actorUserId: fixtures.userB,
      policyVersionId,
      override: {
        additionalRequiredApprovalCount: 2,
        additionalRequiredApproverRoles: [],
        additionalRequiredPermissions: [],
        tightenedConditions: null,
      },
    });

    const decision = await evaluatePolicy(pool, policyCatalog, riskCatalog, registry, {
      ...baseContext("workflow.override"),
      tenantId: fixtures.tenantB,
    });
    expect(decision.requiredApprovalCount).toBeGreaterThanOrEqual(3);
  });
});

describe("evaluatePolicy — workflow step approvalRequired floor (tier 5)", () => {
  it("raises an otherwise-ALLOW decision to REQUIRE_APPROVAL", async () => {
    const decision = await evaluatePolicy(pool, policyCatalog, riskCatalog, registry, {
      ...baseContext("agent.activate"),
      workflowStepApprovalRequired: true,
    });
    expect(decision.effect).toBe("REQUIRE_APPROVAL");
    expect(decision.requiredApprovalCount).toBeGreaterThanOrEqual(1);
  });

  it("does not downgrade an already-stricter effect", async () => {
    await seedUnconditionalPolicy("data.export", "ESCALATE", { priority: 1 });
    const decision = await evaluatePolicy(pool, policyCatalog, riskCatalog, registry, {
      ...baseContext("data.export"),
      workflowStepApprovalRequired: true,
    });
    // data.export already had a REQUIRE_APPROVAL policy from the determinism
    // test above; adding ESCALATE makes ESCALATE win regardless of the floor.
    expect(decision.effect).toBe("ESCALATE");
  });
});

describe("evaluatePolicy — rejects an unregistered action string", () => {
  it("throws for an action outside the closed catalog", async () => {
    await expect(
      evaluatePolicy(pool, policyCatalog, riskCatalog, registry, baseContext("not.a.real.action")),
    ).rejects.toThrow();
  });
});
