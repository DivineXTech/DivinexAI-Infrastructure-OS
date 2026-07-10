#!/usr/bin/env bash
# Applies the local-dev auth/storage shim and all supabase/migrations/*.sql
# to a plain PostgreSQL database, in order. Intended for local sanity-checking
# migrations without a Supabase project — see DATABASE.md.
#
# Usage: DATABASE_URL=postgres://user:pass@localhost:5432/dbname ./scripts/db-migrate-local.sh
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required, e.g. postgres://postgres@localhost:5432/flowramarket_dev" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Applying local auth/storage shim..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$REPO_ROOT/scripts/local-dev-auth-shim.sql"

for migration in "$REPO_ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$migration")..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "Done."
