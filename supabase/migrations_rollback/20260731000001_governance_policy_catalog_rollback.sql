-- Rollback for supabase/migrations/20260731000001_governance_policy_catalog.sql
-- Run AFTER 20260731000002's rollback (its tenant tables reference these
-- platform tables via on delete restrict foreign keys).
-- Destructive — drops the entire platform policy and risk classification catalog.

drop policy if exists risk_classification_versions_select_published on risk_classification_versions;
drop policy if exists risk_classification_definitions_select_authenticated on risk_classification_definitions;
drop policy if exists policy_versions_select_published on policy_versions;
drop policy if exists policy_definitions_select_authenticated on policy_definitions;

drop table if exists risk_classification_versions;
drop table if exists risk_classification_definitions;
drop table if exists policy_versions;
drop table if exists policy_definitions;
