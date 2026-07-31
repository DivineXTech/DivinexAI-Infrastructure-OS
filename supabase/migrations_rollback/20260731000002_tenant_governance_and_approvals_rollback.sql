-- Rollback for supabase/migrations/20260731000002_tenant_governance_and_approvals.sql
-- Run BEFORE 20260731000001's rollback (reverse of application order).
-- Destructive — drops all tenant governance/policy/approval data.

drop policy if exists governance_events_select on governance_events;
drop policy if exists approval_assignments_write_admin on approval_assignments;
drop policy if exists approval_assignments_select on approval_assignments;
drop policy if exists approval_decisions_select on approval_decisions;
drop policy if exists approval_requests_select on approval_requests;
drop policy if exists policy_evaluations_select on policy_evaluations;
drop policy if exists tenant_policy_overrides_write_admin on tenant_policy_overrides;
drop policy if exists tenant_policy_overrides_select_member on tenant_policy_overrides;
drop policy if exists tenant_policy_assignments_write_admin on tenant_policy_assignments;
drop policy if exists tenant_policy_assignments_select_member on tenant_policy_assignments;

delete from permissions where key in (
  'tenant.view_approvals',
  'tenant.decide_approvals',
  'tenant.manage_policies',
  'tenant.view_governance_events'
);

drop table if exists governance_events;
drop table if exists approval_assignments;
drop table if exists approval_decisions;
drop table if exists approval_requests;
drop table if exists policy_evaluations;
drop table if exists tenant_policy_overrides;
drop table if exists tenant_policy_assignments;
