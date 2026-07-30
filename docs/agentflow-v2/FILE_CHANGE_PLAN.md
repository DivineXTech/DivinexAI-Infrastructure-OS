# File Change Plan — Phase 2: Agent Runtime Contracts and Registry

**Status: Revised per the platform-definition / tenant-installation
decision.** This supersedes the previous draft's nullable-`tenant_id`
approach entirely. Implementation proceeds from this revision in the same
turn it was approved.

## Model, in one sentence

Six canonical agents are defined and versioned **once**, platform-owned,
with no `tenant_id`; every tenant that wants one gets its own
**installation row** referencing a specific, explicit, published version —
never a shared nullable-tenant row, never an implicit "latest version."

## Contract revision: lifecycle is now two separate enums, not one

The previous plan's single 8-stage `AgentStatusSchema` is replaced by two
independent lifecycles, per the explicit instruction to separate definition
lifecycle from tenant runtime lifecycle:

- **`AgentVersionStatus`** (platform, on `agent_versions` rows):
  `draft → validated → published → deprecated → retired`. Once `published`,
  a version's manifest content is immutable — a changed manifest creates a
  new version, never an update to an existing one.
- **`TenantAgentLifecycleStatus`** (tenant, on `tenant_agents` rows):
  `REGISTERED → MOCK_EXECUTABLE → EVALUATION_TESTED → TOOL_ENABLED → APPROVAL_GOVERNED → ACTIVE`,
  with `SUSPENDED` reachable from any state after `REGISTERED` and
  reactivation returning only to `ACTIVE`. `DEFINED` does not appear here —
  it described creation of the platform definition, which is now `draft` in
  the version lifecycle instead; it is not a tenant runtime state.

**Consequence for the already-committed `AgentManifest` contract:** the
`status: AgentStatusSchema` field is **removed** from
`AgentManifestMetadataSchema`/`AgentManifest` entirely. A manifest is
authored _content_ (what Sara does, what she may not do); publication state
belongs to the `agent_versions` row that wraps that content, not to the
content itself — carrying a `status` field on the in-code manifest object
would create two competing, driftable sources of truth for the same
concept. `test/manifest.test.ts`'s fixtures and the one test asserting
`status: "unknown-status"` is rejected are updated accordingly (rejection
now comes from a missing/invalid required field, not an invalid status
enum — replaced with a different invalid-metadata case so coverage isn't
lost).

## Revised table definitions

**Platform-owned (no `tenant_id`):**

```sql
create table agent_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                 -- "sara", "nova", ...
  display_name text not null,
  role text not null,
  description text not null,
  ownership_type text not null default 'platform' check (ownership_type in ('platform')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_definition_id uuid not null references agent_definitions (id) on delete cascade,
  version text not null,                      -- semver
  manifest jsonb not null,                    -- AgentManifestMetadata-shaped (no inputSchema/outputSchema — those stay code-side)
  manifest_hash text not null,                -- sha256 of the canonicalized manifest; enforces immutability
  status text not null default 'draft' check (status in ('draft','validated','published','deprecated','retired')),
  published_at timestamptz,
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (agent_definition_id, version)
);

create table agent_capability_definitions (
  agent_version_id uuid not null references agent_versions (id) on delete cascade,
  capability text not null,
  primary key (agent_version_id, capability)
);
```

**Tenant-owned (`tenant_id NOT NULL` everywhere, no nullable-tenant rows
anywhere):**

```sql
create table tenant_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  agent_definition_id uuid not null references agent_definitions (id) on delete restrict,
  agent_version_id uuid not null references agent_versions (id) on delete restrict,
  display_name_override text,
  lifecycle_status text not null default 'REGISTERED'
    check (lifecycle_status in
      ('REGISTERED','MOCK_EXECUTABLE','EVALUATION_TESTED','TOOL_ENABLED','APPROVAL_GOVERNED','ACTIVE','SUSPENDED')),
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  execution_policy jsonb not null default '{}'::jsonb,
  approval_policy jsonb not null default '{}'::jsonb,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent_definition_id),   -- one installation per canonical agent per tenant (Phase 2 scope)
  unique (id, tenant_id)                     -- lets child tables' composite FK enforce tenant_id consistency below
);

create table tenant_agent_capabilities (
  tenant_agent_id uuid not null,
  tenant_id uuid not null references tenants (id) on delete cascade,
  capability text not null,
  primary key (tenant_agent_id, capability),
  foreign key (tenant_agent_id, tenant_id) references tenant_agents (id, tenant_id) on delete cascade
);

create table agent_tool_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tenant_agent_id uuid not null,
  tool_id text not null,                     -- FK to tool_definitions once Phase 5 exists
  created_at timestamptz not null default now(),
  unique (tenant_agent_id, tool_id),
  foreign key (tenant_agent_id, tenant_id) references tenant_agents (id, tenant_id) on delete cascade
);

create table agent_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tenant_agent_id uuid not null,
  knowledge_source_id text not null,         -- FK to knowledge_sources once Phase 6 exists
  created_at timestamptz not null default now(),
  unique (tenant_agent_id, knowledge_source_id),
  foreign key (tenant_agent_id, tenant_id) references tenant_agents (id, tenant_id) on delete cascade
);
```

**Why a composite FK instead of a trigger:** each child table denormalizes
`tenant_id` directly (per instruction — every tenant-owned table has
`tenant_id NOT NULL`, so RLS never needs a join/subquery to find it), but a
denormalized column risks drifting from its parent row's real tenant. The
composite foreign key `(tenant_agent_id, tenant_id) references
tenant_agents (id, tenant_id)` makes Postgres itself reject any row whose
`tenant_id` doesn't match its parent `tenant_agents` row — declarative,
visible in the schema, no trigger, no application code required to keep it
correct.

## Revised registry interfaces

```ts
// packages/agent-runtime/src/platformCatalog.ts
export interface PlatformAgentCatalog {
  getDefinitionBySlug(slug: string): Promise<AgentDefinition | null>;
  listDefinitions(): Promise<AgentDefinition[]>;
  getVersion(agentVersionId: string): Promise<AgentVersion | null>;
  listPublishedVersions(agentDefinitionId: string): Promise<AgentVersion[]>;
}
export class PgPlatformAgentCatalog implements PlatformAgentCatalog {
  /* Queryable-backed */
}

// packages/agent-runtime/src/tenantAgentRegistry.ts
export interface TenantAgentRegistry {
  get(
    tenantId: string,
    agentDefinitionId: string,
  ): Promise<TenantAgentInstallation | null>;
  list(tenantId: string): Promise<TenantAgentInstallation[]>;
  transitionLifecycle(
    tenantAgentId: string,
    to: TenantAgentLifecycleStatus,
  ): Promise<void>;
  setEnabled(tenantAgentId: string, enabled: boolean): Promise<void>;
}
export class PgTenantAgentRegistry implements TenantAgentRegistry {
  /* Queryable-backed */
}
```

Agent execution resolves exclusively through `TenantAgentRegistry` — a
`PlatformAgentCatalog` entry alone is never executable for a tenant; the
(future) executor takes a `TenantAgentInstallation` (which carries its own
`agentVersionId`, `configuration`, `executionPolicy`, `approvalPolicy`), not
a bare `AgentDefinition`.

## Tenant provisioning service

```ts
// packages/agent-runtime/src/provisionTenantAgents.ts
export interface ProvisionTenantAgentsInput {
  tenantId: string;
  actorUserId: string;
  /** Explicit — never resolved implicitly to "whatever is currently published." */
  versionsBySlug: Record<CanonicalAgentSlug, string /* agent_version_id */>;
}
export interface ProvisionTenantAgentsResult {
  created: TenantAgentInstallation[];
  skipped: string[]; // slugs that already had an installation
}
export async function provisionTenantAgents(
  db: Queryable,
  catalog: PlatformAgentCatalog,
  access: TenantAccessEvaluator,
  input: ProvisionTenantAgentsInput,
): Promise<ProvisionTenantAgentsResult>;
```

- Checks `access.checkPermission({ tenantId, userId: actorUserId,
permissionKey: "tenant.manage_agents" })` before doing anything (reuses
  `packages/shared/src/policy.ts`'s existing deterministic evaluator — no
  new authorization mechanism).
- For each of the six slugs: `insert into tenant_agents (...) values (...)
on conflict (tenant_id, agent_definition_id) do nothing returning id` —
  idempotent by construction via the existing unique constraint; only rows
  actually inserted are treated as "created."
- Defaults every new installation to `lifecycle_status = 'REGISTERED'`,
  `enabled = false` — no installation starts `ACTIVE`.
- Calls `recordAuditEvent` (reused from `packages/shared`, Phase 1) once per
  actually-created installation — not for skipped/already-existing ones.
- No database trigger; this is a plain, explicit, idempotent application
  function, per instruction.
- Populating `tenant_agent_capabilities`/`agent_tool_permissions`/
  `agent_knowledge_sources` is explicitly **out of scope** for provisioning
  — nothing in the brief's provisioning requirements asks for it, and doing
  so would mean guessing a default capability/tool grant rather than an
  explicit tenant configuration step (a later phase's concern).

## Platform catalog seeding (new, not previously planned)

Seeding six `agent_definitions` + their first `agent_versions` row cannot be
a hand-written SQL literal without risking drift between the TypeScript
manifest source of truth and the seeded row — especially the integrity
hash. Instead: `packages/agent-runtime/src/seedPlatformCatalog.ts` derives
the seed from the actual manifest objects in code:

```ts
export async function seedPlatformAgentCatalog(
  db: Queryable,
  manifests: AgentManifest[],
): Promise<void>;
```

For each manifest: validates it, computes a `sha256` hash of its
canonicalized metadata, upserts the `agent_definitions` row by `slug`, and
either inserts a new `agent_versions` row (if that `(definition, version)`
pair doesn't exist yet, status `published`) or — if it already exists —
verifies the stored hash matches. A mismatch **throws** rather than
silently overwriting: "manifest changed without a version bump," protecting
the immutability rule declaratively enforced nowhere else. This makes the
seed function idempotent (safe to re-run) while still refusing to launder a
content change through as if it were the same version.

## Migrations

- `supabase/migrations/<next-timestamp>_agent_platform_catalog.sql` — the
  three platform tables above, RLS (read-only for `authenticated`, scoped to
  `published` versions; no write policy at all — service-role/owner-only,
  same integrity pattern as `audit_events`/`security_events`).
- `supabase/migrations/<next-timestamp+1>_tenant_agent_installations.sql` —
  the four tenant-owned tables above, RLS reusing `is_tenant_member`/
  `tenant_has_permission`, plus an insert of the new `tenant.manage_agents`
  permission key into the existing `permissions` catalog.
- Matching rollback files under `supabase/migrations_rollback/`.

Two migrations, not one, so the platform/tenant boundary is visible at the
migration-file level too, and either can be rolled back independently if
only one side needs revisiting.

## Complete RLS policy outline

**Platform tables** (`agent_definitions`, `agent_versions`,
`agent_capability_definitions`) — read-only for tenant users, no
insert/update/delete policy for `authenticated` at all (deny by default;
platform writes happen through a trusted owner/service-role connection,
e.g. the seeding function above):

- `agent_definitions`: `for select using (auth.uid() is not null)` — the
  catalog of _what agents exist_ is not sensitive, and tenants need to
  browse it before installing anything.
- `agent_versions`: `for select using (auth.uid() is not null and status =
'published')` — draft/validated/deprecated/retired versions are not
  exposed to tenant users.
- `agent_capability_definitions`: `for select using (auth.uid() is not null
and exists (select 1 from agent_versions v where v.id =
agent_capability_definitions.agent_version_id and v.status =
'published'))`.

**Tenant tables** (`tenant_agents`, `tenant_agent_capabilities`,
`agent_tool_permissions`, `agent_knowledge_sources`) — identical shape on
all four, reusing the exact helpers from `ADR-0003`:

- Select: `for select using (is_tenant_member(tenant_id))`.
- Write (insert/update/delete): `for all using
(tenant_has_permission(tenant_id, 'tenant.manage_agents')) with check
(tenant_has_permission(tenant_id, 'tenant.manage_agents'))`.

No second authorization mechanism anywhere in this migration.

## Tenant provisioning test cases

Against real local Postgres, restricted `authenticated` role, following the
exact pattern already proven in `packages/shared/test/tenant-isolation.test.ts`:

1. Provisioning a tenant with no existing installations creates exactly six
   `tenant_agents` rows, all `lifecycle_status = 'REGISTERED'`, `enabled =
false`.
2. Re-running provisioning for the same tenant creates zero additional rows
   (idempotent) and reports all six as "skipped."
3. Provisioning records exactly six `audit_events` rows (one per created
   installation) on the first run, zero additional on the second.
4. A caller without `tenant.manage_agents` is rejected before any row is
   written (no partial provisioning on an unauthorized attempt).
5. Tenant A cannot read tenant B's `tenant_agents`/`tenant_agent_capabilities`/
   `agent_tool_permissions`/`agent_knowledge_sources` rows, and cannot write
   to them (mirrors the existing cross-tenant privilege-escalation test
   shape).
6. Any authenticated user can `select` a `published` `agent_versions` row;
   none can `insert`/`update`/`delete` it (attempting fails).
7. An unauthenticated session (no JWT claim) sees zero rows in every one of
   the seven new tables.
8. `seedPlatformAgentCatalog` run twice with identical manifests is a no-op
   the second time; run with a manifest whose content changed but whose
   `version` string didn't throws before writing anything.

## Superseded

The previous plan's nullable-`tenant_id` `agents`/`agent_versions`/
`agent_capabilities` tables and the single 8-stage `AgentStatusSchema` are
withdrawn in favor of everything above.
