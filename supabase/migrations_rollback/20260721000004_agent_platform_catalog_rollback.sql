-- Rollback for supabase/migrations/20260721000004_agent_platform_catalog.sql
-- Run AFTER 20260721000005's rollback (tenant_agents references these
-- tables via ON DELETE RESTRICT, so it must be gone first).
-- Destructive — drops the entire platform agent catalog.

drop policy if exists agent_capability_definitions_select on agent_capability_definitions;
drop policy if exists agent_versions_select_published on agent_versions;
drop policy if exists agent_definitions_select_authenticated on agent_definitions;

drop table if exists agent_capability_definitions;
drop table if exists agent_versions;
drop table if exists agent_definitions;
