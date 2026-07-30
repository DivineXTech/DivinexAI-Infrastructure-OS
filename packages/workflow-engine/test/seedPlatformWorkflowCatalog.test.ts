import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedPlatformWorkflowCatalog } from "../src/seedPlatformWorkflowCatalog.js";
import { clientSolutionAssessmentManifest } from "../src/reference/clientSolutionAssessment.js";
import { createStubAgentResolver } from "./stubAgentResolver.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_workflow_engine";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const resolver = createStubAgentResolver();

beforeAll(async () => {
  await resetAndMigrate(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("seedPlatformWorkflowCatalog", () => {
  it("creates one workflow_definitions row and one published workflow_versions row per manifest", async () => {
    await seedPlatformWorkflowCatalog(pool, resolver, [
      clientSolutionAssessmentManifest,
    ]);

    const { rows: definitions } = await pool.query(
      "select slug from workflow_definitions order by slug",
    );
    expect(definitions.map((r) => r.slug)).toEqual([
      "client_solution_assessment",
    ]);

    const { rows: versions } = await pool.query(
      "select status from workflow_versions where version = '1.0.0'",
    );
    expect(versions).toHaveLength(1);
    expect(versions[0]!.status).toBe("published");
  });

  it("is idempotent — re-running with the same manifest creates no new rows", async () => {
    await seedPlatformWorkflowCatalog(pool, resolver, [
      clientSolutionAssessmentManifest,
    ]);

    const { rows: definitions } = await pool.query(
      "select count(*)::int as count from workflow_definitions",
    );
    const { rows: versions } = await pool.query(
      "select count(*)::int as count from workflow_versions",
    );
    expect(definitions[0]!.count).toBe(1);
    expect(versions[0]!.count).toBe(1);
  });

  it("throws if a manifest's content changed without bumping its version", async () => {
    const mutated = {
      ...clientSolutionAssessmentManifest,
      description: "A completely different description.",
    };

    await expect(
      seedPlatformWorkflowCatalog(pool, resolver, [mutated]),
    ).rejects.toThrow(/manifest changed without a version bump/);

    const { rows } = await pool.query(
      "select manifest from workflow_versions v join workflow_definitions d on d.id = v.workflow_definition_id where d.slug = 'client_solution_assessment'",
    );
    expect(rows[0]!.manifest.description).toBe(
      clientSolutionAssessmentManifest.description,
    );
  });

  it("throws at seed time if a step's agentSlug is unknown, before writing anything", async () => {
    const strictResolver = createStubAgentResolver([]);
    const unknownAgentManifest = {
      ...clientSolutionAssessmentManifest,
      id: "unknown_agent_workflow",
      version: "1.0.0",
    };

    await expect(
      seedPlatformWorkflowCatalog(pool, strictResolver, [unknownAgentManifest]),
    ).rejects.toThrow();

    const { rows } = await pool.query(
      "select 1 from workflow_definitions where slug = 'unknown_agent_workflow'",
    );
    expect(rows).toHaveLength(0);
  });
});
