import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * RLS coverage tests.
 *
 * A live Postgres/Supabase instance isn't available in this environment, so
 * these run in two tiers:
 *   1. Static analysis (always runs): every table created by the
 *      migrations has `row level security` enabled and at least one
 *      `create policy` referencing it.
 *   2. Live policy behavior (opt-in): if SUPABASE_TEST_DB_URL is set to a
 *      real Postgres connection string with the migrations applied, this
 *      would exercise actual anon vs. service-role reads. That suite is not
 *      wired up here — see the note in the skipped block below — because
 *      no live database is reachable in this sandbox; a real deployment
 *      should add it before going to production.
 */

const migrationsDir = join(__dirname, "../../supabase/migrations");
const migrationFiles = ["0001_init.sql", "0002_phase2.sql"];
const sql = migrationFiles
  .map((file) => readFileSync(join(migrationsDir, file), "utf-8"))
  .join("\n");

function extractTableNames(source: string): string[] {
  const matches = [...source.matchAll(/create table if not exists (\w+)/gi)];
  return matches.map((m) => m[1]!);
}

describe("row level security — static coverage", () => {
  const tables = extractTableNames(sql);

  it("finds at least the core tables", () => {
    expect(tables).toEqual(
      expect.arrayContaining([
        "tenants",
        "runs",
        "steps",
        "ideas",
        "videos",
        "audit_log",
        "scenes",
        "scripts",
        "provider_jobs",
        "artifacts",
      ]),
    );
  });

  it.each(extractTableNames(sql))("table %s has RLS enabled", (table) => {
    const pattern = new RegExp(`alter table ${table} enable row level security`, "i");
    expect(sql).toMatch(pattern);
  });

  // tenants/runs/steps intentionally have no per-row policy beyond RLS
  // being enabled (service role bypasses RLS; no client-facing read path
  // exists for them yet), so only assert policy coverage for the tables
  // application code reads directly on behalf of tenant users.
  const tablesRequiringPolicies = [
    "ideas",
    "videos",
    "audit_log",
    "scenes",
    "scripts",
    "provider_jobs",
    "artifacts",
  ];

  it.each(tablesRequiringPolicies)("table %s has at least one policy", (table) => {
    const pattern = new RegExp(`create policy [^;]*\\son ${table}\\b`, "i");
    expect(sql).toMatch(pattern);
  });

  it("audit_log is insert-only (no update/delete policy)", () => {
    expect(sql).toMatch(/create policy "audit log is insert-only" on audit_log\s+for insert/i);
    expect(sql).not.toMatch(/create policy[^;]*on audit_log\s+for (update|delete)/i);
  });
});

describe.skip("row level security — live policy behavior (requires SUPABASE_TEST_DB_URL)", () => {
  // Intentionally not implemented: wiring this up needs a disposable
  // Postgres instance with the migrations applied and both an anon-role
  // and service-role client, none of which exist in this sandbox. A real
  // deployment should add cases here such as:
  //   - an anon client scoped to tenant A cannot read tenant B's runs/ideas
  //   - an anon client cannot insert/update/delete audit_log rows
  //   - the service-role client (used only by server code) bypasses RLS
  it.todo("anon client cannot read another tenant's rows");
  it.todo("anon client cannot write to audit_log");
});
