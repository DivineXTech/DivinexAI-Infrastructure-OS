-- Rollback for supabase/migrations/20260721000007_tenant_workflow_installations.sql
-- Run BEFORE 20260721000006's rollback (reverse of application order).
-- Destructive — drops all tenant workflow installation and execution data.

drop policy if exists workflow_execution_events_select_member on workflow_execution_events;
drop policy if exists workflow_dead_letters_write_admin on workflow_dead_letters;
drop policy if exists workflow_dead_letters_select_member on workflow_dead_letters;
drop policy if exists workflow_step_dependencies_write_admin on workflow_step_dependencies;
drop policy if exists workflow_step_dependencies_select_member on workflow_step_dependencies;
drop policy if exists workflow_steps_write_admin on workflow_steps;
drop policy if exists workflow_steps_select_member on workflow_steps;
drop policy if exists workflow_runs_write_admin on workflow_runs;
drop policy if exists workflow_runs_select_member on workflow_runs;
drop policy if exists tenant_workflows_write_admin on tenant_workflows;
drop policy if exists tenant_workflows_select_member on tenant_workflows;

delete from permissions where key = 'tenant.manage_workflows';

drop table if exists workflow_dead_letters;
drop table if exists workflow_execution_events;
drop table if exists workflow_step_dependencies;
drop table if exists workflow_steps;
drop table if exists workflow_runs;
drop table if exists tenant_workflows;
