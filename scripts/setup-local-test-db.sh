#!/usr/bin/env bash
# Sets up a local Postgres database + roles good enough to run
# packages/shared's tenant-isolation tests against real RLS, without needing
# the full Supabase CLI/Docker stack. See docs/agentflow-v2/adr/ADR-0012-testing-framework.md.
#
# Requires a local Postgres server the current user can reach as the
# `postgres` superuser (via `sudo -u postgres psql` or equivalent — adjust
# the PSQL invocation below if your local setup differs, e.g. Postgres.app
# or a Docker container where `postgres` needs no sudo).
#
# Idempotent: safe to re-run.

set -euo pipefail

PSQL="sudo -u postgres psql"
DB_NAME="agentflow_test"

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

echo "==> Recreating the ${DB_NAME} database"
$PSQL -c "DROP DATABASE IF EXISTS ${DB_NAME};"
$PSQL -c "CREATE DATABASE ${DB_NAME} OWNER postgres;"

echo "==> Verifying TCP connectivity as the restricted 'authenticated' role"
PGPASSWORD=authenticated psql -h 127.0.0.1 -U authenticated -d "${DB_NAME}" -c "select current_user;"

echo "==> Done. Run 'bun run test' (or 'vitest run' inside packages/shared) to apply"
echo "    migrations against ${DB_NAME} and exercise the RLS policies."
