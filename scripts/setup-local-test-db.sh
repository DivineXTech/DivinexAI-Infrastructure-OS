#!/usr/bin/env bash
# Sets up local Postgres databases + roles good enough to run this repo's
# RLS-backed test suites against real RLS, without needing the full
# Supabase CLI/Docker stack. See docs/agentflow-v2/adr/ADR-0012-testing-framework.md.
#
# Requires a local Postgres server the current user can reach as the
# `postgres` superuser (via `sudo -u postgres psql` or equivalent — adjust
# the PSQL invocation below if your local setup differs, e.g. Postgres.app
# or a Docker container where `postgres` needs no sudo).
#
# One database per package (not one shared database) — Turborepo runs each
# package's `test` task concurrently by default, and two packages both
# calling `drop schema public cascade` / `create schema public` against the
# same physical database race each other. Each package's test files default
# to their own DB name; add a new DB_NAMES entry here when a new package
# gains its own RLS-backed test suite.
#
# Idempotent: safe to re-run.

set -euo pipefail

PSQL="sudo -u postgres psql"
DB_NAMES=(agentflow_test agentflow_test_agent_runtime agentflow_test_workflow_engine)

echo "==> Ensuring postgres superuser has a known local password (test-only)"
$PSQL -c "ALTER ROLE postgres PASSWORD 'postgres';"

echo "==> Ensuring the restricted 'authenticated' role exists (mirrors Supabase's real role)"
$PSQL <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated LOGIN PASSWORD 'authenticated' NOSUPERUSER NOBYPASSRLS;
  ELSE
    ALTER ROLE authenticated PASSWORD 'authenticated';
  END IF;
END
$$;
SQL

for DB_NAME in "${DB_NAMES[@]}"; do
  echo "==> Recreating the ${DB_NAME} database"
  $PSQL -c "DROP DATABASE IF EXISTS ${DB_NAME};"
  $PSQL -c "CREATE DATABASE ${DB_NAME} OWNER postgres;"

  echo "==> Verifying TCP connectivity as the restricted 'authenticated' role (${DB_NAME})"
  PGPASSWORD=authenticated psql -h 127.0.0.1 -U authenticated -d "${DB_NAME}" -c "select current_user;"
done

echo "==> Done. Run 'bun run test' to apply migrations against each database"
echo "    and exercise the RLS policies."
