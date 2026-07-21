-- Rollback for supabase/migrations/20260721000002_audit_security_events.sql
-- Destructive — drops both event tables and all data in them.

drop policy if exists security_events_select_permission on security_events;
drop policy if exists audit_events_select_permission on audit_events;

drop table if exists security_events;
drop table if exists audit_events;
