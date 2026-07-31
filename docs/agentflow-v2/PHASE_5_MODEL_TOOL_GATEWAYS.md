# Phase 5 — Model Gateway and Tool Gateway (Design)

**Status: Proposed — architecture gate. Do not implement until reviewed.**
This document, `FILE_CHANGE_PLAN.md`, `IMPLEMENTATION_PLAN.md`,
`RISK_REGISTER.md`, `adr/ADR-0015-model-provider-gateway.md`,
`adr/ADR-0016-tool-registry-and-credentials.md`, and `ADR-0007`'s addendum
are the complete documentation gate for Phase 5. Several design points are
marked **[DECISION NEEDED]** below and summarized in §19 — proceed only
after those are resolved.

## 0. Ownership recap (per the brief)

- **`agent-runtime`** owns: model invocation contracts, the model-provider
  adapter interface, the model-provider registry, model routing, fallback
  selection, structured-output validation, model retry handling, token/cost
  accounting, model redaction, the mock model provider. This is additive to
  `agent-runtime`'s existing Phase 1–4 surface (`manifest.ts`,
  `executionContext.ts`, `executionResult.ts`, `mockAgentAdapter.ts`,
  platform/tenant agent catalogs) — nothing existing is renamed or removed.
- **`tool-registry`** (new package) owns: tool contracts, the tool catalog,
  versioned tool definitions, tenant tool installations, the tool adapter
  interface, agent tool grants, credential-reference resolution _calls_
  (not the resolver abstraction itself — see §7), tool execution,
  tool idempotency, tool input/output validation, redaction, mock tools.
- **`governance`** owns: model and tool policy evaluation, risk
  classification, approval requirements, mandatory platform restrictions —
  reusing, not duplicating, Phase 4's `evaluatePolicy`/`createApprovalRequest`/
  `recordApprovalDecision`/approval-request machinery (§8).
- **`workflow-engine`** owns: durable model/tool execution steps, wait/resume
  behavior, retry propagation, failure propagation, execution integration —
  reusing, not duplicating, Phase 4's step-level approval integration
  (§9).
- **`platform-kernel`** stays limited to deterministic foundational
  primitives (`computeContentHash`); Phase 5 adds no new primitive there.
- **`packages/shared`** gains one new, narrow file for the credential
  abstraction (§7) — flagged as a **[DECISION NEEDED]** placement question,
  not assumed silently.

**Package dependency graph added this phase** (extending Phase 4's
`governance -> workflow-engine` one-way edge):

```
tool-registry -> governance -> workflow-engine
tool-registry -> workflow-engine
agent-runtime -> packages/shared (credential resolver, §7)
tool-registry -> packages/shared (credential resolver, §7)
```

No cycle: `governance` and `workflow-engine` gain no new dependency on
`tool-registry` or `agent-runtime`. `agent-runtime`'s Model Gateway has
**no dependency on `governance` or `tool-registry`** — model routing
enforces mandatory restrictions as deterministic, in-package rules (§3),
not by calling out to `governance`'s approval workflow (§8 explains why).

## 1. Model Gateway data model

### 1a. Platform-owned (no `tenant_id`)

```sql
create table model_provider_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                  -- "anthropic", "openai", "google-gemini", "mock"
  display_name text not null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unlike agent/workflow/policy definitions, a model has no nested
-- manifest content worth splitting into a separate "_versions" child
-- table — its capability set and identity are simple, flat fields. It is
-- still immutable-once-published via the same version+hash discipline
-- (a changed model row is a new version row, never an in-place edit),
-- collapsed into one table rather than two for this narrower shape.
create table model_definitions (
  id uuid primary key default gen_random_uuid(),
  model_provider_definition_id uuid not null references model_provider_definitions (id) on delete cascade,
  slug text not null,                          -- "claude-sonnet-5", "gpt-5", "mock-model"
  version text not null,                        -- semver; a capability change is a new version, never an edit
  display_name text not null,
  content_hash text not null,                   -- enforces the immutability guard at the application layer
  context_window_tokens integer not null,
  max_output_tokens integer not null,
  supports_structured_output boolean not null default true,
  supports_streaming boolean not null default false,
  data_classifications jsonb not null default '[]'::jsonb, -- classifications this model is permitted to process, e.g. ["public","internal"]
  allowed_regions jsonb not null default '[]'::jsonb,       -- [] = no region restriction
  status text not null default 'draft'
    check (status in ('draft', 'validated', 'published', 'deprecated', 'retired')),
  published_at timestamptz,
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (model_provider_definition_id, slug, version)
);

create table model_capability_definitions (
  model_definition_id uuid not null references model_definitions (id) on delete cascade,
  capability text not null,                     -- "structured-output", "tool-use", "vision", "long-context", "reasoning"
  primary key (model_definition_id, capability)
);

-- Immutable once published, exactly mirroring policy_versions/
-- risk_classification_versions (Phase 4) — cost estimation and the
-- persisted model_usage_ledger must remain historically reproducible
-- against the pricing that actually applied to a given invocation.
create table model_pricing_versions (
  id uuid primary key default gen_random_uuid(),
  model_definition_id uuid not null references model_definitions (id) on delete cascade,
  version text not null,
  input_price_per_1k_tokens numeric(12, 6) not null,
  output_price_per_1k_tokens numeric(12, 6) not null,
  currency text not null default 'USD',
  pricing_hash text not null,
  status text not null default 'draft'
    check (status in ('draft', 'validated', 'published', 'deprecated', 'retired')),
  effective_from timestamptz,
  effective_until timestamptz,
  published_at timestamptz,
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (model_definition_id, version)
);
```

Lifecycle: `ModelDefinitionStatus`/`ModelPricingVersionStatus` — the same
five-state `draft -> validated -> published -> deprecated -> retired`
transition table already used four times (agent/workflow/policy/risk
classification versions), declared independently in `agent-runtime` per
the established "each package owns its own versioning vocabulary" rule.

### 1b. Tenant-owned (`tenant_id NOT NULL` everywhere)

```sql
-- Sensitive metadata (credential_reference never contains a plaintext
-- secret, §7) — SELECT gated on permission, write only through a governed
-- command, never raw RLS insert/update (§2, mirrors approval_requests'
-- Phase 4 lockdown for the same "never let a client write this directly"
-- reason, here about secret hygiene rather than authorization bypass).
create table tenant_model_provider_configurations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  model_provider_definition_id uuid not null references model_provider_definitions (id) on delete restrict,
  credential_reference jsonb not null,          -- CredentialReference (§7); never a plaintext secret
  enabled boolean not null default false,
  allowed_regions jsonb not null default '[]'::jsonb,       -- [] = inherit platform default
  allowed_data_classifications jsonb not null default '[]'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, model_provider_definition_id),
  unique (id, tenant_id)
);

-- Standard select-member/write-admin pair (tenant.manage_models) — no
-- secrets here, just tenant-side allow/deny and budget configuration.
create table tenant_model_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  model_definition_id uuid references model_definitions (id) on delete restrict, -- null = applies to every model from an enabled provider
  model_provider_definition_id uuid references model_provider_definitions (id) on delete restrict,
  allowed boolean not null default true,        -- tenant can opt out of a platform-permitted model
  max_cost_per_invocation_usd numeric(12, 6),
  max_cost_per_workflow_run_usd numeric(12, 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (model_definition_id is not null or model_provider_definition_id is not null)
);

-- The logical invocation — one row per idempotency key (§10). Read-only
-- for tenant roles; the worker/gateway writes through the trusted
-- connection (mirrors workflow_execution_events' integrity design).
create table model_invocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tenant_agent_id uuid,                         -- composite FK below
  workflow_run_id uuid,
  workflow_step_id uuid,
  purpose text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ROUTING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'BUDGET_EXCEEDED', 'CANCELLED')),
  requested_capabilities jsonb not null default '[]'::jsonb,
  provider_restrictions jsonb not null default '[]'::jsonb,
  data_classification text not null,
  region_restriction text,
  max_cost_usd numeric(12, 6),
  timeout_ms integer not null,
  max_attempts integer not null default 3,
  fallback_permitted boolean not null default true,
  idempotency_key text,
  trace_id text not null,
  selected_model_definition_id uuid references model_definitions (id) on delete restrict,
  selected_provider_definition_id uuid references model_provider_definitions (id) on delete restrict,
  structured_output jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  total_tokens_used integer,
  estimated_cost_usd numeric(12, 6),
  latency_ms integer,
  attempts_count integer not null default 0,
  fallback_used boolean not null default false,
  safety_signals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (tenant_agent_id, tenant_id) references tenant_agents (id, tenant_id) on delete set null,
  foreign key (workflow_run_id, tenant_id) references workflow_runs (id, tenant_id),
  foreign key (workflow_step_id, tenant_id) references workflow_steps (id, tenant_id),
  unique (tenant_id, idempotency_key),          -- Postgres allows multiple NULLs — no key means no idempotency guarantee, same convention as workflow_runs
  unique (id, tenant_id)
);

-- Persisted independently from the logical invocation (a durability
-- requirement, not an optimization) — one row per attempt, never updated
-- after its own terminal write.
create table model_invocation_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  model_invocation_id uuid not null,
  attempt_number integer not null,
  provider_definition_id uuid not null references model_provider_definitions (id) on delete restrict,
  model_definition_id uuid not null references model_definitions (id) on delete restrict,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'TIMED_OUT')),
  started_at timestamptz,
  completed_at timestamptz,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  cost_usd numeric(12, 6),
  error jsonb,
  safety_signals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (model_invocation_id, tenant_id) references model_invocations (id, tenant_id) on delete cascade,
  unique (model_invocation_id, attempt_number)
);

-- Append-only usage ledger — one row per completed invocation. Budget
-- enforcement (§12) sums this table; no separate rollup/aggregation job
-- in Phase 5.
create table model_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  model_invocation_id uuid,
  tenant_agent_id uuid,
  workflow_run_id uuid,
  model_definition_id uuid not null references model_definitions (id) on delete restrict,
  usage_date date not null default current_date,
  tokens_used integer not null,
  cost_usd numeric(12, 6) not null,
  created_at timestamptz not null default now(),
  foreign key (model_invocation_id, tenant_id) references model_invocations (id, tenant_id) on delete cascade
);
```

## 2. Model Gateway RLS policy outline

New permission keys: `tenant.manage_models`, `tenant.view_model_usage`.

```sql
-- Platform tables: read-only for any authenticated user, published rows only.
create policy model_provider_definitions_select_authenticated on model_provider_definitions
  for select using (auth.uid() is not null);
create policy model_definitions_select_published on model_definitions
  for select using (auth.uid() is not null and status = 'published');
create policy model_pricing_versions_select_published on model_pricing_versions
  for select using (auth.uid() is not null and status = 'published');

-- tenant_model_provider_configurations: SELECT only, gated on
-- tenant.manage_models — credential_reference is sensitive metadata; no
-- insert/update/delete policy of any kind. Creation/rotation is a governed
-- command (provisionTenantModelProviderConfiguration, §7) over the
-- trusted connection.
create policy tenant_model_provider_configurations_select on tenant_model_provider_configurations
  for select using (tenant_has_permission(tenant_id, 'tenant.manage_models'));

-- tenant_model_policies: standard select-member/write-admin pair — no
-- secrets here.
create policy tenant_model_policies_select_member on tenant_model_policies
  for select using (is_tenant_member(tenant_id));
create policy tenant_model_policies_write_admin on tenant_model_policies
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_models'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_models'));

-- model_invocations / model_invocation_attempts / model_usage_ledger:
-- read-only, gated on tenant.view_model_usage OR tenant.manage_models — no
-- write policy at all, mirroring workflow_execution_events.
create policy model_invocations_select on model_invocations
  for select using (
    tenant_has_permission(tenant_id, 'tenant.view_model_usage')
    or tenant_has_permission(tenant_id, 'tenant.manage_models')
  );
create policy model_invocation_attempts_select on model_invocation_attempts
  for select using (
    tenant_has_permission(tenant_id, 'tenant.view_model_usage')
    or tenant_has_permission(tenant_id, 'tenant.manage_models')
  );
create policy model_usage_ledger_select on model_usage_ledger
  for select using (
    tenant_has_permission(tenant_id, 'tenant.view_model_usage')
    or tenant_has_permission(tenant_id, 'tenant.manage_models')
  );
```

No second authorization mechanism: every check above is
`is_tenant_member`/`tenant_has_permission` against the existing
`tenant_memberships`/`role_permissions`/`permissions` tables.

## 3. Model Gateway contracts

```ts
// packages/agent-runtime/src/model/modelInvocation.ts
export const ModelCapabilitySchema = z.enum([
  "structured-output",
  "tool-use",
  "vision",
  "long-context",
  "reasoning",
]);
export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;

export const DataClassificationSchema = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
]);
export type DataClassification = z.infer<typeof DataClassificationSchema>;

export const ModelMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

export const ModelInvocationRequestSchema = z.object({
  tenantId: z.string().uuid(),
  tenantAgentId: z.string().uuid().nullable(),
  workflowRunId: z.string().uuid().nullable(),
  workflowStepId: z.string().uuid().nullable(),
  purpose: z.string().min(1),
  messages: z.array(ModelMessageSchema).min(1),
  systemInstructions: z.string().nullable(),
  requiredOutputSchemaId: z.string().min(1), // a registered schema key (§3a), never a raw ad hoc schema
  requiredCapabilities: z.array(ModelCapabilitySchema),
  providerRestrictions: z.array(z.string()), // provider slugs this call may use; [] = platform/tenant defaults apply
  dataClassification: DataClassificationSchema,
  regionRestriction: z.string().nullable(),
  maxCostUsd: z.number().nonnegative().nullable(),
  timeoutMs: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  fallbackPermitted: z.boolean(),
  idempotencyKey: z.string().nullable(),
  traceId: z.string().min(1),
});
export type ModelInvocationRequest = z.infer<
  typeof ModelInvocationRequestSchema
>;

export const ModelUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});
export type ModelUsage = z.infer<typeof ModelUsageSchema>;

export const ModelSafetySignalSchema = z.object({
  category: z.string().min(1), // e.g. "refusal", "content-flag", "low-confidence"
  severity: z.enum(["info", "warning", "blocking"]),
  detail: z.string(),
});
export type ModelSafetySignal = z.infer<typeof ModelSafetySignalSchema>;

export const ModelInvocationAttemptSchema = z.object({
  attemptNumber: z.number().int().positive(),
  providerSlug: z.string().min(1),
  modelSlug: z.string().min(1),
  status: z.enum([
    "PENDING",
    "IN_PROGRESS",
    "SUCCEEDED",
    "FAILED",
    "TIMED_OUT",
  ]),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
  usage: ModelUsageSchema.nullable(),
  error: z
    .object({ code: z.string(), message: z.string(), retryable: z.boolean() })
    .nullable(),
  safetySignals: z.array(ModelSafetySignalSchema),
});
export type ModelInvocationAttempt = z.infer<
  typeof ModelInvocationAttemptSchema
>;

export const StructuredOutputValidationResultSchema = z.object({
  valid: z.boolean(),
  data: z.unknown().nullable(), // present only when valid
  errors: z.array(z.object({ path: z.string(), message: z.string() })),
});
export type StructuredOutputValidationResult = z.infer<
  typeof StructuredOutputValidationResultSchema
>;

export const ModelInvocationResultSchema = z.object({
  id: z.string().uuid(),
  provider: z.string().min(1),
  model: z.string().min(1),
  status: z.enum(["SUCCEEDED", "FAILED", "BUDGET_EXCEEDED", "CANCELLED"]),
  structuredOutput: z.unknown().nullable(),
  validation: StructuredOutputValidationResultSchema,
  usage: ModelUsageSchema.nullable(),
  estimatedCostUsd: z.number().nonnegative().nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
  attempts: z.array(ModelInvocationAttemptSchema),
  fallbackUsed: z.boolean(),
  safetySignals: z.array(ModelSafetySignalSchema),
});
export type ModelInvocationResult = z.infer<typeof ModelInvocationResultSchema>;
```

**Deliberately excluded from every schema above:** any field for raw
provider "reasoning"/hidden chain-of-thought. `ModelInvocationAttempt`
records only `usage`/`latency`/`status`/`safetySignals` — a provider
adapter that receives hidden reasoning content from the underlying API
must discard it before constructing this record; nothing downstream
(persistence, events, logs) ever sees it. This is enforced at the adapter
boundary (§13), not by hoping call sites remember to redact.

```ts
// packages/agent-runtime/src/model/modelProviderAdapter.ts
export interface ModelProviderAdapter {
  readonly providerSlug: string;
  invoke(
    request: ModelInvocationRequest,
    model: ModelDefinition,
  ): Promise<ModelInvocationResult>;
}

// packages/agent-runtime/src/model/modelProviderRegistry.ts
export interface ModelProviderRegistry {
  getProvider(providerSlug: string): ModelProviderAdapter | null;
  listEligibleModels(
    request: ModelInvocationRequest,
  ): Promise<ModelDefinition[]>; // pre-filtered by platform/tenant config (§4)
}

// packages/agent-runtime/src/model/modelRoutingPolicy.ts
export interface ModelRoutingPolicy {
  rank(
    request: ModelInvocationRequest,
    candidates: readonly ModelDefinition[],
  ): ModelDefinition[]; // deterministic order, most-preferred first
  selectFallback(
    request: ModelInvocationRequest,
    candidates: readonly ModelDefinition[],
    excluding: readonly string[], // model definition ids already attempted
  ): ModelDefinition | null;
}

// packages/agent-runtime/src/model/invokeModel.ts — the orchestration entry point
export async function invokeModel(
  db: Queryable,
  registry: ModelProviderRegistry,
  routingPolicy: ModelRoutingPolicy,
  request: ModelInvocationRequest,
): Promise<ModelInvocationResult>;
```

### 3a. Required output schema registry (not raw schemas over the wire)

`requiredOutputSchemaId` is a registered key (e.g.
`"agent-execution-result.v1"`), not a serialized JSON Schema — mirrors the
existing agent/workflow/tool convention that Zod schemas are **code**, not
data (§1c of `PHASE_1_AGENT_WORKFLOW_CONTRACTS.md`; the same reasoning
`AgentManifest`'s `inputSchema`/`outputSchema` already establishes).
`packages/agent-runtime/src/model/outputSchemaRegistry.ts` maps a small,
closed set of schema IDs to real `z.ZodType` instances; `invokeModel`
looks up the schema by ID and validates the provider's structured output
against it, producing `StructuredOutputValidationResult`. A malformed or
schema-violating provider response is a **validation failure recorded on
the attempt**, not a thrown exception that skips persistence — `invokeModel`
still writes the attempt row, then applies the same retry/fallback
decision a provider error would trigger (§10).

## 4. Model routing algorithm (deterministic, pure function of published rows + context)

```
routeModel(request):
  1. load tenant_model_provider_configurations for request.tenantId
     where enabled = true -> the tenant's usable provider set
  2. exclude any provider/model a platform-mandatory restriction forbids
     (model_definitions.allowed_regions/data_classifications, always
     enforced, never overridable by tenant config — the model-level
     analogue of Phase 4's "platform mandatory" tier)
  3. exclude any model a tenant_model_policies row marks allowed = false
     (tenant opt-out, mirrors Phase 4's tenant_policy_assignments
     default-on-unless-disabled semantics)
  4. filter to models whose data_classifications include
     request.dataClassification and (if set) allowed_regions include
     request.regionRestriction
  5. filter to models whose capability set (model_capability_definitions)
     is a superset of request.requiredCapabilities
  6. filter to models where supports_structured_output = true whenever
     request.requiredOutputSchemaId is set (always, per §3)
  7. filter to models whose context_window_tokens is sufficient for the
     rendered messages (a deterministic token-count estimate, not a model
     call)
  8. estimate cost = renderedPromptTokens * model's current published
     model_pricing_versions row's input price, plus a configured
     estimated-completion-token ceiling * output price
  9. reject (BUDGET_EXCEEDED, §12) any model whose estimated cost exceeds
     request.maxCostUsd, the tenant's per-invocation budget, or the
     workflow run's remaining budget — never silently drop to a cheaper
     model without recording why (§12)
  10. rank remaining eligible models deterministically: platform-declared
      priority (a new model_definitions.priority column), then lowest
      estimated cost, then model_definition_id — the same
      "priority, then a stable tie-break" discipline as governance's
      evaluatePolicy reason ordering (Phase 4 §4c)
  11. select the top-ranked model for the first attempt; if
      request.fallbackPermitted, the ranked list (minus already-attempted
      models) is the fallback sequence for retries (§10)
```

**Fallback must not weaken any requirement:** the fallback sequence is
computed once, from the _same_ filtered-and-ranked candidate list step 1–10
already produced — a fallback model was already required to pass every
security/geography/schema/capability/cost filter to appear in that list at
all. There is no separate, laxer "fallback eligibility" pass. `selectFallback`
narrows the same list; it never re-queries with different (weaker)
criteria.

**No hard-coded agent-to-provider binding:** `invokeModel` receives only a
`ModelInvocationRequest` — no agent slug, no provider name. Sara, Forge, and
every other agent go through the identical routing function; an agent's
manifest may express _preferences_ via `requiredCapabilities`/
`providerRestrictions` (data, not code), never a direct import of a
provider adapter.

## 5. Tool Gateway data model

### 5a. Platform-owned (no `tenant_id`)

```sql
create table tool_definitions (
  id uuid primary key default gen_random_uuid(),
  namespace text not null,                      -- "knowledge", "repository", "document", "communication"
  name text not null,                           -- "search", "inspect", "generate", "prepare"
  display_name text not null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (namespace, name)
);

-- Manifest metadata only (input/outputSchema are real z.ZodType instances
-- in code, exactly like AgentManifest/WorkflowManifest — never
-- reconstructed from this jsonb column; only the metadata projection is
-- stored, mirroring workflow_versions.manifest).
create table tool_versions (
  id uuid primary key default gen_random_uuid(),
  tool_definition_id uuid not null references tool_definitions (id) on delete cascade,
  version text not null,
  manifest jsonb not null,                      -- ToolManifestMetadata (§6)
  manifest_hash text not null,
  status text not null default 'draft'
    check (status in ('draft', 'validated', 'published', 'deprecated', 'retired')),
  risk_level text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  side_effect_classification text not null
    check (side_effect_classification in ('none', 'read_only', 'reversible', 'irreversible')),
  published_at timestamptz,
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tool_definition_id, version)
);

create table tool_capability_definitions (
  tool_version_id uuid not null references tool_versions (id) on delete cascade,
  capability text not null,
  primary key (tool_version_id, capability)
);
```

### 5b. Tenant-owned (`tenant_id NOT NULL` everywhere)

```sql
create table tenant_tools (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tool_definition_id uuid not null references tool_definitions (id) on delete restrict,
  tool_version_id uuid not null references tool_versions (id) on delete restrict, -- explicit version, never "latest"
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, tool_definition_id),
  unique (id, tenant_id)
);

-- Sensitive metadata (credential_reference, never a plaintext secret) —
-- SELECT gated on permission, write only through a governed command, same
-- lockdown as tenant_model_provider_configurations and (Phase 4)
-- approval_requests.
create table tenant_tool_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tenant_tool_id uuid not null,
  credential_reference jsonb not null,
  scope text,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rotated_at timestamptz,
  foreign key (tenant_tool_id, tenant_id) references tenant_tools (id, tenant_id) on delete cascade
);

-- Extends the existing Phase 2 agent_tool_permissions table in place
-- rather than introducing a redundant new table — see §19 [DECISION
-- NEEDED]. Shown here as the target additive shape.
alter table agent_tool_permissions
  add column tenant_tool_id uuid references tenant_tools (id) on delete cascade;
-- agent_tool_permissions.tool_id (text, never populated — a Phase 2
-- forward reference with no real FK) is left in place, deprecated in
-- comment, not dropped (no destructive operation).

create table tool_invocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tenant_agent_id uuid,
  tenant_tool_id uuid not null,
  workflow_run_id uuid not null,
  workflow_step_id uuid not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'VALIDATING', 'AWAITING_APPROVAL', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'BUDGET_EXCEEDED', 'CANCELLED')),
  governed_action text,                         -- validated against governance's closed action catalog only if non-null
  risk_level text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  input jsonb not null,
  input_hash text not null,                     -- hash of (toolSlug, input, targetResource) — the tool-invocation analogue of Phase 4's action payload_hash
  target_resource text,
  idempotency_key text,
  external_idempotency_key text,                -- passed to the external system, §10
  policy_evaluation_id uuid,                    -- cross-package composite FK into governance.policy_evaluations
  approval_request_id uuid,                     -- cross-package composite FK into governance.approval_requests — REUSES Phase 4's tables, no new approval mechanism
  credential_reference_id uuid,
  output jsonb,
  output_hash text,
  error jsonb,
  attempts_count integer not null default 0,
  max_attempts integer not null default 3,
  timeout_ms integer not null,
  next_event_sequence bigint not null default 1,
  trace_id text not null,
  correlation_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (tenant_agent_id, tenant_id) references tenant_agents (id, tenant_id) on delete set null,
  foreign key (tenant_tool_id, tenant_id) references tenant_tools (id, tenant_id) on delete restrict,
  foreign key (workflow_run_id, tenant_id) references workflow_runs (id, tenant_id),
  foreign key (workflow_step_id, tenant_id) references workflow_steps (id, tenant_id),
  foreign key (policy_evaluation_id, tenant_id) references policy_evaluations (id, tenant_id),
  foreign key (approval_request_id, tenant_id) references approval_requests (id, tenant_id),
  foreign key (credential_reference_id, tenant_id) references tenant_tool_credentials (id, tenant_id),
  unique (tenant_id, idempotency_key),
  unique (id, tenant_id)
);

create table tool_invocation_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tool_invocation_id uuid not null,
  attempt_number integer not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'TIMED_OUT')),
  started_at timestamptz,
  completed_at timestamptz,
  latency_ms integer,
  output jsonb,
  error jsonb,
  external_reference text,                      -- the external system's own returned id, when available (§10)
  created_at timestamptz not null default now(),
  foreign key (tool_invocation_id, tenant_id) references tool_invocations (id, tenant_id) on delete cascade,
  unique (tool_invocation_id, attempt_number)
);

-- Sequence-locked, exactly like workflow_execution_events — a tool
-- invocation's own event history needs strict gapless ordering the same
-- way a workflow run's does (unlike governance_events' looser design,
-- Phase 4 §1).
create table tool_execution_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tool_invocation_id uuid not null,
  event_type text not null,
  actor_type text not null check (actor_type in ('user', 'agent', 'system', 'worker')),
  actor_id text,
  trace_id text not null,
  correlation_id text not null,
  causation_id uuid,
  sequence_number bigint not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (tool_invocation_id, tenant_id) references tool_invocations (id, tenant_id) on delete cascade,
  unique (tool_invocation_id, sequence_number)
);
```

## 6. Tool Gateway contracts

```ts
// packages/tool-registry/src/toolManifest.ts
export const SideEffectClassificationSchema = z.enum([
  "none",
  "read_only",
  "reversible",
  "irreversible",
]);

export const ToolCredentialRequirementSchema = z.object({
  credentialType: z.string().min(1), // "api-key", "oauth2", "basic-auth", "none"
  required: z.boolean(),
});
export type ToolCredentialRequirement = z.infer<
  typeof ToolCredentialRequirementSchema
>;

export const ToolManifestMetadataSchema = z.object({
  namespace: z.string().min(1),
  name: z.string().min(1),
  version: z
    .string()
    .regex(
      /^\d+\.\d+\.\d+$/,
      "version must be semver in the form major.minor.patch",
    ),
  description: z.string().min(1),
  capability: z.string().min(1),
  /** Validated against governance's closed GovernedActionSchema only when non-null — a plain string here, same "no compile-time dependency" discipline as workflow-engine's governedAction (Phase 4). */
  governedAction: z.string().min(1).nullable().default(null),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  requiredPermissions: z.array(z.string().min(1)),
  supportedCredentials: z.array(ToolCredentialRequirementSchema),
  timeoutMs: z.number().int().positive(),
  retryPolicy: RetryPolicySchema, // reused from @repo/workflow-engine — one retry vocabulary, not a second
  idempotencyRequirement: z.enum(["none", "internal", "external"]),
  sideEffectClassification: SideEffectClassificationSchema,
  permittedDataClassifications: z.array(DataClassificationSchema).min(1),
});
export type ToolManifestMetadata = z.infer<typeof ToolManifestMetadataSchema>;

export interface ToolManifest<
  TInput = unknown,
  TOutput = unknown,
> extends ToolManifestMetadata {
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
}

export function validateToolManifest<TInput, TOutput>(
  manifest: ToolManifest<TInput, TOutput>,
): ToolManifest<TInput, TOutput>; // mirrors validateAgentManifest/validateWorkflowManifest exactly

// packages/tool-registry/src/toolInvocation.ts
export const ToolInvocationRequestSchema = z.object({
  tenantId: z.string().uuid(),
  tenantAgentId: z.string().uuid().nullable(),
  workflowRunId: z.string().uuid(),
  workflowStepId: z.string().uuid(),
  toolSlug: z.string().min(1), // "namespace.name", validated against the closed tool catalog — never an arbitrary unregistered name
  input: z.record(z.string(), z.unknown()),
  targetResource: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  traceId: z.string().min(1),
  correlationId: z.string().min(1),
});
export type ToolInvocationRequest = z.infer<typeof ToolInvocationRequestSchema>;

export interface ToolInvocationResult {
  id: string;
  status:
    | "SUCCEEDED"
    | "FAILED"
    | "AWAITING_APPROVAL"
    | "BUDGET_EXCEEDED"
    | "CANCELLED";
  output: unknown | null;
  validationErrors: Array<{ path: string; message: string }>;
  approvalRequestId: string | null; // set only when status === "AWAITING_APPROVAL"
  attempts: ToolInvocationAttempt[];
  error: { code: string; message: string; retryable: boolean } | null;
}

export interface ToolInvocationAttempt {
  attemptNumber: number;
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "TIMED_OUT";
  startedAt: string | null;
  completedAt: string | null;
  latencyMs: number | null;
  externalReference: string | null;
  error: { code: string; message: string; retryable: boolean } | null;
}

// packages/tool-registry/src/toolAdapter.ts
export interface ToolAdapter<TInput = unknown, TOutput = unknown> {
  readonly toolSlug: string;
  execute(input: TInput, ctx: ToolExecutionContext): Promise<TOutput>;
}

/**
 * The MINIMUM typed context an adapter receives — never the raw tenant or
 * workflow row, never unrestricted step context (the brief's explicit
 * "no adapter should receive unrestricted tenant or workflow context").
 */
export interface ToolExecutionContext {
  tenantId: string;
  traceId: string;
  timeoutMs: number;
  credential: ResolvedCredential | null; // scoped, already-resolved (§7) — never a CredentialReference locator
}

// packages/tool-registry/src/platformToolCatalog.ts
export interface PlatformToolCatalog {
  getDefinitionBySlug(
    namespace: string,
    name: string,
  ): Promise<ToolDefinition | null>;
  listPublishedVersions(toolDefinitionId: string): Promise<ToolVersion[]>;
}

// packages/tool-registry/src/tenantToolRegistry.ts
export interface TenantToolRegistry {
  get(
    tenantId: string,
    toolDefinitionId: string,
  ): Promise<TenantToolInstallation | null>;
  list(tenantId: string): Promise<TenantToolInstallation[]>;
}

// packages/tool-registry/src/agentToolGrants.ts
export interface AgentToolGrant {
  id: string;
  tenantId: string;
  tenantAgentId: string;
  tenantToolId: string;
  createdAt: string;
}
export interface AgentToolGrantRegistry {
  isGranted(tenantAgentId: string, tenantToolId: string): Promise<boolean>;
}
```

## 7. Credential model

**[DECISION NEEDED — placement, see §19]** Proposed: a new, narrow file,
`packages/shared/src/credentials.ts` — cross-cutting infrastructure used
identically by `agent-runtime` (`tenant_model_provider_configurations`) and
`tool-registry` (`tenant_tool_credentials`); neither package "owns" credential
resolution more than the other, unlike `platform-kernel`'s content-hashing
(a narrow, dependency-free artifact-versioning concern — `ADR-0014`).
Placement in `packages/shared` follows the same reasoning already used for
`PgTenantAccessEvaluator`: tenancy/security-adjacent infrastructure every
capability package needs, not a capability itself.

```ts
// packages/shared/src/credentials.ts
export const CredentialReferenceSchema = z.object({
  id: z.string().uuid(),
  providerType: z.string().min(1), // "anthropic", "openai", "stripe-mock", ...
  secretManagerType: z.enum(["env", "supabase-vault", "kms"]),
  locator: z.string().min(1), // secret path or opaque locator — NEVER the secret value itself
  version: z.string().nullable(),
  scope: z.string().nullable(),
  status: z.enum(["active", "revoked", "expired"]),
  createdAt: z.string().datetime(),
  rotatedAt: z.string().datetime().nullable(),
});
export type CredentialReference = z.infer<typeof CredentialReferenceSchema>;

export interface ResolvedCredential {
  credentialReferenceId: string;
  /** The actual secret value, held only in memory for the duration of one adapter call — never logged, serialized into an event/approval snapshot, or returned to a client. */
  value: string;
}

export interface CredentialResolver {
  resolve(reference: CredentialReference): Promise<ResolvedCredential>;
}

/** Local-development-only resolver: locator is an environment variable name. Production resolvers (Supabase Vault-backed, KMS-backed) implement the same interface — see ADR-0007's addendum. */
export class EnvCredentialResolver implements CredentialResolver {
  async resolve(reference: CredentialReference): Promise<ResolvedCredential> {
    const value = process.env[reference.locator];
    if (!value) {
      throw new Error(
        `No environment value found for credential locator "${reference.locator}"`,
      );
    }
    return { credentialReferenceId: reference.id, value };
  }
}
```

**Never appears in logs, events, prompts, approval snapshots, test
fixtures, or client responses:** `ResolvedCredential.value` is constructed
immediately before an adapter call and passed only as `ToolExecutionContext.credential`/
the model provider adapter's own scoped argument — never assigned to a
variable that a logging call, `appendGovernanceEvent`,
`appendWorkflowExecutionEvent`, `tool_execution_events` payload, or an
`ActionSnapshot` (Phase 4) could serialize. `CredentialReference` itself
(the locator/scope/status metadata) is what gets persisted and may appear
in an event payload — never `ResolvedCredential`. A lint rule (or a
targeted unit test asserting no serialized event payload contains a known
test-secret value) enforces this is more than a convention (§16 test
matrix, "secret leakage prevention").

Test fixtures use `EnvCredentialResolver` against a test-only, obviously-
fake environment variable value (e.g. `MOCK_TOOL_API_KEY=test-fixture-not-a-real-secret`)
— never a real credential shape that could be mistaken for one.

## 8. Governance integration

Two distinct touchpoints, not one — **[DECISION NEEDED, see §19]** for
confirmation of this split:

**Model invocations** — governed by **deterministic routing restrictions
only** (§4 steps 2–3), never the human-approval workflow. Reasoning: the
brief's own required path diagram (`Agent -> Model Gateway -> structured
proposed action -> Governance -> Tool Gateway -> external adapter`) places
`governance` between the model's _output_ (a proposed action) and the Tool
Gateway — not between the agent and the Model Gateway. Routing a routine
inference call through a human-approval wait would be poor UX for the
common case and isn't what the brief's diagram describes. Platform-mandatory
model restrictions (region, data classification, disallowed provider) are
enforced as hard, structural exclusions during routing (§4) — the model
equivalent of Phase 4's "platform mandatory" policy tier, but resolved
without ever creating an `approval_requests` row.

**Tool invocations** — governed by the **full Phase 4 machinery, reused
verbatim**:

```
executeToolInvocation(db, access, request):
  1. resolve the published ToolVersion for request.toolSlug
  2. resolve the tenant's tenant_tools installation (must be enabled)
  3. verify an agent_tool_permissions grant exists for
     (tenant_agent_id, tenant_tool_id) — UnauthorizedToolError otherwise
  4. validate request.input against the tool's inputSchema (Zod)
  5. classify: dataClassification (from input's target/parameters) and the
     tool version's own sideEffectClassification
  6. if the tool version declares a governedAction: call the SAME
     governance.evaluatePolicy already built in Phase 4, with
     action = tool version's governedAction — persists a policy_evaluations
     row exactly as before
  7. if the decision requires approval (REQUIRE_APPROVAL/ESCALATE): call
     the SAME governance.createApprovalRequest, with the tool's proposed
     input/output as the action_snapshot's parameters/proposedOutput; call
     workflow-engine.enterWaitingForApproval(workflowStepId) — the EXACT
     Phase 4 function, no new wait/resume primitive; return
     { status: "AWAITING_APPROVAL", approvalRequestId }
  8. resolve the credential reference via the tenant's tenant_tool_credentials
     row + the configured CredentialResolver (§7) — scoped to this call only
  9. persist tool_invocations row (status EXECUTING) before calling the
     adapter (§10)
  10. execute the adapter with ONLY ToolExecutionContext (§6) — never the
      raw tenant/workflow row
  11. validate adapter output against the tool's outputSchema
  12. redact any protected value the tool's manifest flags (§11)
  13. persist tool_invocation_attempts, tool_execution_events, and (if this
      was a governed, approved call) resume via the SAME
      workflow-engine.resumeWorkflowStepAfterApproval already built —
      no new resumption mechanism
  14. return the structured ToolInvocationResult
```

**No new approval-request schema.** `tool_invocations.policy_evaluation_id`/
`approval_request_id` are composite-FK references into `governance`'s
existing `policy_evaluations`/`approval_requests` tables (Phase 4) — the
identical pattern `approval_requests` already uses to reference
`workflow_steps` one-way. `tool-registry` depends on `governance` (calls
`evaluatePolicy`/`createApprovalRequest`) and on `workflow-engine` (calls
`enterWaitingForApproval`/`resumeWorkflowStepAfterApproval`/
`reconcileWorkflowRunOutcome`) — neither of those packages gains any
dependency on `tool-registry`.

## 9. Workflow-engine integration

One additive field on `WorkflowStepDefinitionSchema`, mirroring
`governedAction`'s Phase 4 precedent exactly:

```ts
// packages/workflow-engine/src/manifest.ts — additive
toolCalls: z.array(z.object({
  toolSlug: z.string().min(1),
  governedAction: z.string().min(1).nullable(),
})).default([]),
```

A step declares which tools it's permitted to invoke; at execution time,
if the agent/model's structured output proposes a tool call matching a
declared `toolCalls` entry, the executor (`apps/worker`, mirroring
Phase 4's inline governed-action handling exactly) calls
`tool-registry.executeToolInvocation`. If that returns `AWAITING_APPROVAL`,
the **step** — not a separate "tool step" — is already parked at
`WAITING_FOR_APPROVAL` (step 7 of §8's sequence already called
`enterWaitingForApproval` for this exact `workflowStepId`); the step's
resumed output is the tool's replayed result, exactly like Phase 4's
`deliver_external` step. **No new workflow-engine primitive is required at
all** — `reconcileWorkflowRunOutcome`, the step/run status machines, and
the exactly-once resume gate are reused unchanged.

A step with no `toolCalls` entries behaves exactly as it does today
(agent-only execution) — fully backward compatible, a compatibility test
required (§16).

## 10. Idempotency, durability, and uncertain external outcomes

- **Creation is idempotent**: `model_invocations`/`tool_invocations` both
  key on `unique (tenant_id, idempotency_key)`, Postgres's multiple-NULLs
  behavior giving "no key = no idempotency guarantee" exactly like
  `workflow_runs` (Phase 3).
- **Persist execution intent before calling the adapter**: both `PENDING`/
  `EXECUTING` rows are written and committed _before_ `invoke`/`execute` is
  called (§8 step 9) — a crash between "decided to call" and "actually
  called" leaves a recoverable row, not a silent gap.
- **Attempts persisted independently**: `model_invocation_attempts`/
  `tool_invocation_attempts` are inserted per attempt, immediately on
  start and again on completion — never batched with the parent row's
  update.
- **Recovery after worker interruption**: `reconcileModelGatewayRuntime`/
  `reconcileToolGatewayRuntime` (mirroring Phase 3/4's
  `reconcileWorkflowRuntime`/`reconcileGovernanceRuntime` exactly) scan for
  `IN_PROGRESS`/`EXECUTING` rows whose most recent attempt exceeded
  `timeoutMs` with no terminal write, and apply the retry/dead-letter
  decision (reusing `workflow-engine`'s `classifyOutcome`, one retry
  vocabulary) rather than assuming success or silently retrying a
  possibly-already-executed **irreversible** side effect.
- **External idempotency-key strategy (side-effecting tools)**:
  `tool_invocations.external_idempotency_key` is a distinct value (derived
  from `input_hash` + `tool_invocation_id`, never reused across a
  supersession) passed to the external system's own idempotency-key
  parameter where the adapter's target API supports one (e.g. Stripe-style
  `Idempotency-Key` headers) — documented per-adapter, not assumed
  universal.
- **Unknown external outcome handling**: if an adapter call times out or
  the connection drops _after_ the external system may have already
  applied the side effect, the attempt is recorded `TIMED_OUT` with
  `external_reference: null` (outcome genuinely unknown) — recovery does
  **not** auto-retry a `TIMED_OUT` attempt for a tool version whose
  `sideEffectClassification` is `irreversible`; it surfaces the invocation
  in a `MANUAL_RECONCILIATION_REQUIRED`-flagged state (a `tool_invocations`
  status value reserved for this, distinct from ordinary `FAILED`) instead
  of guessing. `read_only`/`reversible` tools may auto-retry per their
  declared `retryPolicy`, since a duplicate read or a reversible action is
  a materially different risk than a duplicate irreversible one. None of
  the four required Phase 5 mock tools are `irreversible`
  (`knowledge.search`/`repository.inspect` are `read_only`;
  `document.generate`/`communication.prepare` are `reversible` — they
  produce/stage an artifact, never send or publish it) — this path is
  designed and tested, not exercised by the reference workflow's happy
  path.

## 11. Security controls

| Threat                                                                                                        | Control                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt injection (malicious content in retrieved knowledge/tool output steering the model)                    | Model and tool output are both treated as **untrusted input** at every boundary — retrieved content is data appended to a message, never concatenated into `systemInstructions`; a model's structured output proposing a tool call is validated against the step's declared `toolCalls` allowlist (§9) before anything executes — injected text cannot grant a capability the step didn't already declare |
| Tool-output injection (a tool's returned content re-enters a later model call and is treated as instructions) | Tool output is wrapped as inert data in the next `ModelMessageSchema` entry (`role: "user"`, never `"system"`); output schema validation (§6) rejects any tool response that doesn't match its declared shape before it's ever placed in a message                                                                                                                                                        |
| SSRF / arbitrary URL access                                                                                   | Mock tools accept no caller-supplied URL at all in Phase 5 (§13); the tool contract has **no generic "fetch this URL" tool** — a future real adapter needing outbound HTTP must allowlist specific hosts in its own manifest, never accept an arbitrary tenant/model-supplied URL as adapter input                                                                                                        |
| Shell/command injection                                                                                       | No tool adapter shells out or interprets a string as a command; `repository.inspect`'s mock implementation reads from an in-memory fixture, never a real filesystem/process in Phase 5                                                                                                                                                                                                                    |
| Path traversal                                                                                                | No tool accepts a raw filesystem path from model/tenant input in Phase 5; a future file-touching adapter must resolve paths against an allowlisted root and reject `..`/absolute-path escapes at the adapter boundary, documented per-adapter                                                                                                                                                             |
| Credential exfiltration                                                                                       | `ResolvedCredential.value` never crosses a serialization boundary (§7); adapters receive it as an in-memory argument only, scoped to one call                                                                                                                                                                                                                                                             |
| Redirect abuse                                                                                                | N/A in Phase 5 (no tool follows HTTP redirects); flagged for any future HTTP-capable adapter to cap redirect count and re-validate the allowlist per hop                                                                                                                                                                                                                                                  |
| Oversized payloads                                                                                            | `ModelInvocationRequest`/`ToolInvocationRequest` inputs are size-capped (§12); adapters reject input exceeding the declared max before processing                                                                                                                                                                                                                                                         |
| Decompression bombs                                                                                           | N/A in Phase 5 (no adapter decompresses untrusted data); a future adapter accepting compressed payloads must cap decompressed size before allocating                                                                                                                                                                                                                                                      |
| Unsafe MIME types                                                                                             | N/A in Phase 5 (no file-upload-shaped tool); flagged for `document.generate`'s eventual real successor to allowlist output MIME types explicitly                                                                                                                                                                                                                                                          |
| Malformed structured output                                                                                   | `StructuredOutputValidationResult`/tool output-schema validation — a validation failure is a recorded, structured outcome (§3a), never a thrown exception that skips persistence or silently coerces                                                                                                                                                                                                      |
| Sensitive-data leakage                                                                                        | `dataClassification`/`permittedDataClassifications` enforced at routing (models, §4) and at tool execution (§8 step 5); redaction step (§8 step 12, tool manifest-declared protected-value paths) before persistence                                                                                                                                                                                      |
| Timeout and partial response behavior                                                                         | Every invocation carries `timeoutMs`; a timeout produces a structured `TIMED_OUT` attempt (§10), never a hung request or a partial structured-output object treated as complete                                                                                                                                                                                                                           |

**Prefer allowlisted, typed adapters over arbitrary URLs, commands, or
scripts** — the governing principle behind every row above: Phase 5 ships
zero tools capable of arbitrary network/filesystem/process access at all.

## 12. Budget controls

Enforced at every named level:

| Level      | Mechanism                                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform   | `model_definitions`/`tool_versions` mandatory restrictions (§4, §8) — never overridable                                                                                      |
| Tenant     | `tenant_model_policies.max_cost_per_invocation_usd`/`max_cost_per_workflow_run_usd`; tenant tool enable/disable                                                              |
| Workflow   | Sum of `model_usage_ledger`/tool-invocation cost (where priced) for the run's `workflow_run_id`, checked against a run-level ceiling before routing permits a new invocation |
| Agent      | `tenant_agents.execution_policy` (existing Phase 2 column) may carry a per-agent cost ceiling, read by routing                                                               |
| Run        | Same mechanism as "Workflow" above — a `workflow_run_id`-scoped `model_usage_ledger` sum                                                                                     |
| Step       | `ModelInvocationRequest.maxCostUsd`/timeout/max-attempts are per-step-invocation values, the finest granularity                                                              |
| Invocation | `maxCostUsd`, `timeoutMs`, `maxAttempts` on the request itself                                                                                                               |

Minimum Phase 5 controls, all listed above map directly to a brief
requirement: max model cost per invocation ✅, max model cost per workflow
run ✅ (workflow-level sum), max model attempts ✅ (`maxAttempts`), max tool
attempts ✅ (`tool_invocations.max_attempts`), max model/tool duration ✅
(`timeoutMs` both), max input/output payload size ✅ (§11's size cap, a
constant enforced in `ModelInvocationRequestSchema`/`ToolInvocationRequestSchema`
via `z.string().max(...)`/an explicit byte-length check on `input`), persisted
tenant usage ledger ✅ (`model_usage_ledger`; tool-side usage is
`tool_invocations` itself, priced tools out of scope for Phase 5's mock
set), explicit budget-exceeded result ✅ (`BUDGET_EXCEEDED` is a first-class
status value on both invocation tables, never a generic `FAILED`).

**Do not silently route to an ineligible model after a budget
violation**: §4 step 9 excludes over-budget models from the _candidate_
list before ranking — a `BUDGET_EXCEEDED` result is only returned when
**no** eligible model remains under budget, never produced by silently
picking a cheaper model the request didn't ask for and calling it success.

## 13. Initial adapters

**Required, ship as code in Phase 5:**

- **Mock model provider** (`packages/agent-runtime/src/model/providers/mockModelProvider.ts`)
  — deterministic `ModelProviderAdapter`, no network call, produces
  schema-valid structured output for whatever `requiredOutputSchemaId`
  the request declares, synthesizes plausible token usage from
  input/output length, zero cost or a small fixed mock cost, no safety
  signals by default (configurable per test).
- **`knowledge.search`** (`read_only`) — searches an in-memory fixture
  document set, returns ranked snippets with provenance.
- **`repository.inspect`** (`read_only`) — reads from an in-memory fixture
  "repository" (file tree + contents), returns structure/content summaries.
- **`document.generate`** (`reversible`) — produces a structured document
  artifact (e.g. a markdown/JSON summary) held in the invocation's own
  `output`, no external system touched.
- **`communication.prepare`** (`reversible`) — drafts/stages an outbound
  communication (subject/body/recipient) **without sending it**; distinct
  from Phase 4's already-governed `communication.send.external` action —
  `communication.prepare` itself declares no `governedAction` at all (it
  has no side effect yet), while a future real "send" tool would carry
  `governedAction: "communication.send.external"` and reuse Phase 4's
  existing risk classification/policy for that action unchanged.

All four mock tools and the mock model provider support full deterministic
integration testing with zero network access — the standard test suite
never requires live provider access.

**One real model-provider adapter, proposed but not built in Phase 5**:
given this environment has no live provider credentials and the standing
rule that the standard test suite must stay network-independent, Phase 5
ships the `ModelProviderAdapter` interface fully specified and the folder
seam already named in `IMPLEMENTATION_PLAN.md` §2
(`packages/agent-runtime/providers/anthropic/`), but no working Anthropic
(or other) adapter — this is itself a valid form of "proposed": a
documented, interface-complete seam a later phase fills with exactly one
new adapter file, gated behind `tenant_model_provider_configurations.enabled`

- a feature flag, per the brief's own requirement. Confirm this is
  acceptable (§19) rather than building a real adapter now.

**Not implemented in Phase 5** (per instruction): real external
communication, payments, payouts, production deployment, destructive
database execution, secret rotation.

## 14. Reference workflow

New version, `client_solution_assessment` **v1.2.0** — extends v1.1.0
(Phase 4, unchanged/not mutated), adding model- and tool-backed steps
between `guardian_review` and `sara_synthesize`:

```
... -> guardian_review -> nova_research (tool: knowledge.search)
                        -> forge_inspect (tool: repository.inspect)
                        -> sara_synthesize (model-backed; was mock-only in v1.0/v1.1)
                        -> sara_draft_delivery (tool: document.generate, or communication.prepare)
                        -> deliver_external (unchanged from v1.1.0 — governance/approval gate)
```

Exercises, end to end: structured model invocation (`sara_synthesize` now
actually calls `invokeModel` against the mock provider, validating its
output against a registered schema instead of returning a hand-built mock
object), model routing (candidate filtering/ranking runs for real, even
though only the mock provider is eligible), `knowledge.search`,
`repository.inspect`, `document.generate` **and/or** `communication.prepare`
(at least one, per the brief), persisted model/tool attempts, governance
interception (the existing `deliver_external` gate, now potentially fed by
a tool-produced `proposedOutput` instead of a hand-built one), approval
waiting, exactly-once continuation, and run completion via the unchanged
`reconcileWorkflowRunOutcome`.

## 15. Proposed file tree

```
packages/agent-runtime/src/model/
  modelInvocation.ts            (contracts, §3)
  modelProviderAdapter.ts        (interface)
  modelProviderRegistry.ts       (interface + PgModelProviderRegistry)
  modelRoutingPolicy.ts          (interface + DeterministicModelRoutingPolicy, §4)
  outputSchemaRegistry.ts        (§3a)
  invokeModel.ts                 (orchestration entry point)
  modelDefinitionLifecycle.ts    (ModelDefinitionStatus transitions)
  modelPricingVersionLifecycle.ts
  platformModelCatalog.ts        (PlatformModelCatalog / PgPlatformModelCatalog)
  seedPlatformModelCatalog.ts
  tenantModelConfigRegistry.ts   (read access; mutation via provisionTenantModelProviderConfiguration)
  provisionTenantModelProviderConfiguration.ts (governed command, §2)
  modelUsageLedger.ts
  recovery.ts                    (reconcileModelGatewayRuntime, §10)
  providers/
    mock/mockModelProvider.ts

packages/tool-registry/                 (new package)
  package.json, tsconfig.json, eslint.config.js, vitest.config.ts
  src/
    toolManifest.ts              (§6)
    toolInvocation.ts            (§6)
    toolAdapter.ts                (§6)
    toolVersionLifecycle.ts
    platformToolCatalog.ts
    seedPlatformToolCatalog.ts
    tenantToolRegistry.ts
    provisionTenantTool.ts
    agentToolGrants.ts           (extends agent_tool_permissions, §5b/§19)
    tenantToolCredentials.ts     (governed command: createTenantToolCredential)
    executeToolInvocation.ts     (the 14-step sequence, §8)
    toolExecutionEvents.ts
    recovery.ts                  (reconcileToolGatewayRuntime, §10)
    adapters/
      knowledgeSearch.ts
      repositoryInspect.ts
      documentGenerate.ts
      communicationPrepare.ts
    index.ts

packages/shared/src/credentials.ts       (CredentialReference, CredentialResolver, EnvCredentialResolver — §7, §19)

packages/workflow-engine/src/manifest.ts (extended — toolCalls field, §9)

packages/governance/                     (no code changes required — evaluatePolicy/createApprovalRequest already generic enough to reuse, §8)

apps/worker/src/index.ts                 (extended — invokeModel for model-backed steps; executeToolInvocation for tool-backed steps; both reuse the existing enterWaitingForApproval/reconcileWorkflowRunOutcome call sites)

supabase/migrations/
  <ts>_model_gateway_platform_catalog.sql
  <ts+1>_tenant_model_gateway.sql
  <ts+2>_tool_gateway_platform_catalog.sql
  <ts+3>_tenant_tool_gateway.sql   (includes the additive agent_tool_permissions.tenant_tool_id column, §19)

supabase/migrations_rollback/ (matching rollbacks, reverse order)
```

## 16. Migration and rollback order

Apply: model platform catalog → tenant model gateway (references model
platform tables + `tenant_agents`/`workflow_runs`/`workflow_steps`,
already existing) → tool platform catalog → tenant tool gateway
(references tool platform tables + `tenant_agents`/`workflow_runs`/
`workflow_steps` + `governance`'s `policy_evaluations`/`approval_requests`,
already existing — **no migration changes those tables**). Roll back in
exact reverse. The `agent_tool_permissions.tenant_tool_id` column addition
rides in the tenant-tool-gateway migration (additive `ALTER TABLE ADD
COLUMN`, nullable, no data migration needed since the existing `tool_id
text` column was never populated in any real environment).

## 17. Test matrix

| Area                                   | Notes                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model request/result schema validation | Every field, every enum boundary                                                                                                                                                                                                |
| Model provider registration            | Seed + immutability-guard (changed content without version bump throws)                                                                                                                                                         |
| Deterministic model routing            | Same inputs → identical ranked order across repeated calls                                                                                                                                                                      |
| Provider restriction enforcement       | A tenant-disabled or platform-restricted provider never selected                                                                                                                                                                |
| Data-classification restrictions       | A model lacking a required classification is excluded, never silently used                                                                                                                                                      |
| Model fallback eligibility             | Fallback candidates already passed every filter; a model failing any filter is never a fallback target                                                                                                                          |
| Structured-output validation           | Valid/invalid payloads against a registered schema ID                                                                                                                                                                           |
| Malformed-output rejection             | Recorded as a structured validation failure, not a thrown exception that skips persistence                                                                                                                                      |
| Token and cost accounting              | `model_usage_ledger` row matches the attempt's recorded usage                                                                                                                                                                   |
| Invocation budget enforcement          | `maxCostUsd` exceeded → `BUDGET_EXCEEDED`, no fallback attempted beyond budget                                                                                                                                                  |
| Run-budget enforcement                 | Workflow-level cost sum exceeded → `BUDGET_EXCEEDED` even when a cheaper model exists but wasn't requested                                                                                                                      |
| Model idempotency                      | Same idempotency key twice returns the same `model_invocations` row                                                                                                                                                             |
| Provider timeout and retry             | Timeout → structured `TIMED_OUT` attempt, retry per policy, never a silent hang                                                                                                                                                 |
| Tool definition/version validation     | Manifest schema + immutability guard                                                                                                                                                                                            |
| Tenant tool installation               | Pinned to explicit version; idempotent                                                                                                                                                                                          |
| Tenant-agent tool grants               | Grant required before any invocation proceeds                                                                                                                                                                                   |
| Unauthorized tool rejection            | No grant → `UnauthorizedToolError`, never a silent no-op success                                                                                                                                                                |
| Tool input and output validation       | Schema-valid/invalid cases                                                                                                                                                                                                      |
| Governance interception                | A tool declaring `governedAction` routes through the exact Phase 4 `evaluatePolicy` path                                                                                                                                        |
| Approval-required tool execution       | `AWAITING_APPROVAL` → `recordApprovalDecision` (reused, unmodified) → step resumes exactly once                                                                                                                                 |
| Credential-reference redaction         | No event/log/fixture ever contains a resolved secret value                                                                                                                                                                      |
| Secret leakage prevention              | Assert across every persisted table/event payload in a test run — the value never appears                                                                                                                                       |
| Tool idempotency                       | Same idempotency key twice returns the same `tool_invocations` row                                                                                                                                                              |
| Attempt persistence                    | Every attempt independently row-inserted, survives a simulated crash between attempt-insert and parent-row update                                                                                                               |
| Cross-tenant isolation                 | All new platform + tenant tables, mirroring Phases 2–4's pattern                                                                                                                                                                |
| Direct table mutation denial           | `tenant_model_provider_configurations`/`tenant_tool_credentials`/`tool_invocations`/`model_invocations` reject client INSERT/UPDATE/DELETE even holding every relevant permission — the Phase 4 Decision-3 proof, repeated here |
| Worker interruption recovery           | `reconcileModelGatewayRuntime`/`reconcileToolGatewayRuntime` reclaim an `IN_PROGRESS`/`EXECUTING` row past its timeout without duplicating a completed side effect                                                              |
| Unknown external outcome handling      | A `TIMED_OUT` attempt on an `irreversible` tool does not auto-retry; surfaces for manual reconciliation                                                                                                                         |
| Full reference-workflow integration    | `client_solution_assessment` v1.2.0 end-to-end through every new step to `COMPLETED`, mock adapters only                                                                                                                        |

Isolated local Postgres test databases (`agentflow_test_agent_runtime`
gains model-gateway tests; new `agentflow_test_tool_registry`), same
`fileParallelism: false` discipline. The standard test suite remains
deterministic and network-independent — the mock provider and mock tools
are what the entire suite runs against.

## 18. On `ADR-0002` (Google ADK) and `ADR-0004` (workflow runtime, superseded)

`ADR-0002`'s `AgentProvider`/ADK boundary is orthogonal to this phase's
`ModelProviderAdapter` — ADK, if ever integrated, would be one more
_orchestration_-level provider under `agent-runtime/providers/google-adk/`,
translating its own run/event model at that boundary; it is not a
`ModelProviderAdapter` itself and this phase does not touch it.
`IMPLEMENTATION_PLAN.md` §7's `ADR-0004-workflow-runtime.md` reference
predates Phase 3's actual implementation (`PHASE_3_WORKFLOW_RUNTIME.md`)
and is stale — flagged here, not fixed silently (see `RISK_REGISTER.md`
row 12's existing pattern for stale phase/ADR cross-references).

## 19. Decisions requiring confirmation before implementation

1. **`agent_tool_permissions` (Phase 2) vs. a new `agent_tool_grants`
   table.** Proposed: extend the existing table in place (§5b) — add
   `tenant_tool_id`, keep the never-populated `tool_id text` column
   (deprecated in comment, not dropped), and treat it as the
   `AgentToolGrant` concept the brief names, rather than create a second,
   redundant table. Confirm, or direct a rename/new-table approach instead.
2. **Model-invocation governance scope.** Proposed: model invocations are
   governed by deterministic routing restrictions only (§4, §8); the full
   `evaluatePolicy`/approval-request workflow applies to the **tool**
   invocation a model proposes, not to the model call itself. Confirm this
   reading of "model and tool policy evaluation" under `governance`'s
   ownership, or direct that routine model invocations must also be able to
   reach `REQUIRE_APPROVAL`/human sign-off before the provider is ever
   called.
3. **Credential-abstraction placement.** Proposed: `packages/shared/src/credentials.ts`
   (§7), since neither `agent-runtime` nor `tool-registry` owns credential
   resolution more than the other. Confirm, or direct a different home
   (e.g. a narrow addition to `platform-kernel`, or its own package).
4. **Real model-provider adapter.** Proposed: specify the
   `ModelProviderAdapter` interface fully and name the
   `providers/anthropic/` seam, but ship no working real adapter in Phase 5
   (no live credentials/network in this environment; standard test suite
   must stay network-independent). Confirm this satisfies "one real
   model-provider adapter may be proposed."

No other blocker identified. Everything else in this document is a
proposed default, not a question — implementation proceeds on all
non-flagged points once these four are resolved.
