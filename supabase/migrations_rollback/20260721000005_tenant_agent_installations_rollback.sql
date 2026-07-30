-- Rollback for supabase/migrations/20260721000005_tenant_agent_installations.sql
-- Run BEFORE 20260721000004's rollback (reverse of application order).
-- Destructive — drops all tenant agent installation data.

drop policy if exists agent_knowledge_sources_write_admin on agent_knowledge_sources;
drop policy if exists agent_knowledge_sources_select_member on agent_knowledge_sources;
drop policy if exists agent_tool_permissions_write_admin on agent_tool_permissions;
drop policy if exists agent_tool_permissions_select_member on agent_tool_permissions;
drop policy if exists tenant_agent_capabilities_write_admin on tenant_agent_capabilities;
drop policy if exists tenant_agent_capabilities_select_member on tenant_agent_capabilities;
drop policy if exists tenant_agents_write_admin on tenant_agents;
drop policy if exists tenant_agents_select_member on tenant_agents;

delete from permissions where key = 'tenant.manage_agents';

drop table if exists agent_knowledge_sources;
drop table if exists agent_tool_permissions;
drop table if exists tenant_agent_capabilities;
drop table if exists tenant_agents;
