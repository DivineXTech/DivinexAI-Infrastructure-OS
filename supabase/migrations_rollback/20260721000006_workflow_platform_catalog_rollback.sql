-- Rollback for supabase/migrations/20260721000006_workflow_platform_catalog.sql
-- Run AFTER 20260721000007's rollback (tenant_workflows/workflow_runs
-- reference these tables via ON DELETE RESTRICT, so they must be gone
-- first).
-- Destructive — drops the entire platform workflow catalog.

drop policy if exists workflow_versions_select_published on workflow_versions;
drop policy if exists workflow_definitions_select_authenticated on workflow_definitions;

drop table if exists workflow_versions;
drop table if exists workflow_definitions;
