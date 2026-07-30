import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedPlatformAgentCatalog } from "../src/seedPlatformCatalog.js";
import {
  CANONICAL_AGENT_MANIFESTS,
  saraManifest,
} from "../src/agents/index.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_agent_runtime";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });

beforeAll(async () => {
  await resetAndMigrate(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("seedPlatformAgentCatalog", () => {
  it("creates one agent_definitions row and one published agent_versions row per manifest", async () => {
    await seedPlatformAgentCatalog(pool, CANONICAL_AGENT_MANIFESTS);

    const { rows: definitions } = await pool.query(
      "select slug from agent_definitions order by slug",
    );
    expect(definitions.map((r) => r.slug)).toEqual([
      "forge",
      "guardian",
      "nova",
      "pulse",
      "reven",
      "sara",
    ]);

    const { rows: versions } = await pool.query(
      "select status from agent_versions where version = '0.1.0'",
    );
    expect(versions).toHaveLength(6);
    expect(versions.every((r) => r.status === "published")).toBe(true);
  });

  it("is idempotent — re-running with the same manifests creates no new rows", async () => {
    await seedPlatformAgentCatalog(pool, CANONICAL_AGENT_MANIFESTS);

    const { rows: definitions } = await pool.query(
      "select count(*)::int as count from agent_definitions",
    );
    const { rows: versions } = await pool.query(
      "select count(*)::int as count from agent_versions",
    );
    expect(definitions[0]!.count).toBe(6);
    expect(versions[0]!.count).toBe(6);
  });

  it("throws if a manifest's content changed without bumping its version", async () => {
    const mutatedSara = {
      ...saraManifest,
      mission: "A completely different mission.",
    };

    await expect(seedPlatformAgentCatalog(pool, [mutatedSara])).rejects.toThrow(
      /manifest changed without a version bump/,
    );

    // and it must not have silently written the mutated content
    const { rows } = await pool.query(
      "select manifest from agent_versions v join agent_definitions d on d.id = v.agent_definition_id where d.slug = 'sara'",
    );
    expect(rows[0]!.manifest.mission).toBe(saraManifest.mission);
  });
});
