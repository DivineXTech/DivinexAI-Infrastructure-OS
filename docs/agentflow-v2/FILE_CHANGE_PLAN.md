# File Change Plan — Phase 5: Model Gateway and Tool Gateway

**Status: Proposed — architecture gate, not yet approved.** This
supersedes the Phase 4 content that previously occupied this file. Full
design rationale lives in `PHASE_5_MODEL_TOOL_GATEWAYS.md`; this file is
the file-change-plan excerpt of that document. Four decisions are flagged
for confirmation in that document's §19 — implementation does not start
until they're resolved.

## Model, in one sentence

A new Model Gateway inside `packages/agent-runtime` deterministically
routes every agent's model invocation to an eligible, budget-respecting
provider/model (never a hard-coded binding), persists the request and
every attempt independently, and validates structured output against a
registered schema — while a new `packages/tool-registry` package resolves
a versioned, tenant-installed, agent-granted tool, reuses Phase 4's
`governance`/`workflow-engine` approval machinery verbatim when a tool
declares a governed action, and executes the adapter with only the
minimum typed input and a scoped, already-resolved credential — never the
raw tenant/workflow context or a credential locator the adapter would
have to resolve itself.

## New package: `packages/tool-registry`

Mirrors `governance`'s Phase 4 structure exactly (own
`package.json`/`tsconfig.json`/`eslint.config.js`/`vitest.config.ts`).
Depends on `@repo/shared` (credentials, §7 of the design doc),
`@repo/platform-kernel`, `@repo/governance` (evaluatePolicy/
createApprovalRequest — reused, not duplicated), and `@repo/workflow-engine`
(enterWaitingForApproval/resumeWorkflowStepAfterApproval/
reconcileWorkflowRunOutcome). No dependency on `@repo/agent-runtime`: a
tool invocation's proposed action is a plain string/data payload, the same
"no compile-time dependency where a plain value suffices" discipline used
throughout this codebase. See `PHASE_5_MODEL_TOOL_GATEWAYS.md` §15 for the
full file tree.

## Extended package: `packages/agent-runtime`

New `src/model/` subtree (Model Gateway) — additive only; nothing in
`manifest.ts`/`executionContext.ts`/`executionResult.ts`/
`mockAgentAdapter.ts` changes. The existing `AgentAdapter.execute`
contract is unchanged; Model Gateway integration is an internal detail of
how a (future) real or model-backed adapter produces its
`AgentExecutionResult`, per `ADR-0015`.

## New/revised table definitions

See `PHASE_5_MODEL_TOOL_GATEWAYS.md` §1/§5 for full DDL. Summary:

**Model Gateway — platform-owned (no `tenant_id`), four tables:**
`model_provider_definitions`, `model_definitions` (flat, version+hash-guarded
— no separate `_versions` child table; a model's capability set is simple
enough not to need the definition/version split agents/workflows/policies
use), `model_capability_definitions`, `model_pricing_versions` (immutable
once published, mirrors `policy_versions`).

**Model Gateway — tenant-owned, five tables:**
`tenant_model_provider_configurations` (contains a `CredentialReference`,
never a plaintext secret — **select-only, no client write policy at all**),
`tenant_model_policies` (standard select-member/write-admin pair, no
secrets), `model_invocations` (the logical, idempotency-keyed invocation —
select-only), `model_invocation_attempts` (persisted independently per
attempt — select-only), `model_usage_ledger` (append-only — select-only).

**Tool Gateway — platform-owned (no `tenant_id`), three tables:**
`tool_definitions`, `tool_versions` (manifest metadata only — real Zod
schemas live in code, exactly like `AgentManifest`/`WorkflowManifest`;
immutable once published), `tool_capability_definitions`.

**Tool Gateway — tenant-owned, five tables plus one extended:**
`tenant_tools` (pinned to explicit version, mirrors `tenant_workflows`),
`tenant_tool_credentials` (`CredentialReference`, never plaintext —
select-only), `tool_invocations` (composite-FK references into
`governance.policy_evaluations`/`approval_requests` — **reuses Phase 4's
approval tables, no new approval schema**; select-only), `tool_invocation_attempts`
(select-only), `tool_execution_events` (sequence-locked, mirrors
`workflow_execution_events`; select-only). **Extended, additive:**
`agent_tool_permissions` (Phase 2) gains `tenant_tool_id` — becomes the
brief's `AgentToolGrant` record rather than a new, redundant table
(flagged for confirmation, design doc §19 item 1).

All new child tables use the established composite-foreign-key pattern
for tenant consistency. No migration touches `workflow_steps`,
`workflow_runs`, `policy_evaluations`, or `approval_requests` themselves —
Phase 5's tables reference them one-way, exactly the precedent
`approval_requests` set toward `workflow_steps` in Phase 4.

## Revised/new interfaces

```ts
// packages/agent-runtime/src/model/invokeModel.ts
export async function invokeModel(
  db: Queryable,
  registry: ModelProviderRegistry,
  routingPolicy: ModelRoutingPolicy,
  request: ModelInvocationRequest,
): Promise<ModelInvocationResult>;

// packages/tool-registry/src/executeToolInvocation.ts — the 14-step governed sequence
export async function executeToolInvocation(
  db: Queryable,
  access: TenantAccessEvaluator,
  request: ToolInvocationRequest,
): Promise<ToolInvocationResult>;
```

Neither function imports the other package's schema directly for
decision-making — `tool-registry` calls `governance.evaluatePolicy`/
`workflow-engine.enterWaitingForApproval` with already-resolved plain
data, exactly as `governance` already does toward `workflow-engine` since
Phase 4.

## Contract extension (additive; compatibility test required)

- `packages/workflow-engine/src/manifest.ts`: `WorkflowStepDefinitionSchema`
  gains `toolCalls` (array, default `[]`) — a step declares which tools it
  may invoke, mirroring `governedAction`'s Phase 4 precedent exactly. A
  step with no `toolCalls` behaves identically to today. No change to
  `status.ts`'s transition tables — tool-invocation waits reuse the
  existing `WAITING_FOR_APPROVAL` step/run states verbatim, no new status
  needed.

## New package: `packages/shared` gains one file

`packages/shared/src/credentials.ts` — `CredentialReference`,
`CredentialResolver`, `EnvCredentialResolver`. Flagged for confirmation
(design doc §19 item 3) since `packages/shared` does not grow by default;
proposed here specifically because neither `agent-runtime` nor
`tool-registry` owns credential resolution more than the other.

## Migrations

- `supabase/migrations/<ts>_model_gateway_platform_catalog.sql` — the four
  Model Gateway platform tables, RLS read-only for `authenticated` scoped
  to `published` rows.
- `supabase/migrations/<ts+1>_tenant_model_gateway.sql` — the five tenant
  tables, two new permission keys (`tenant.manage_models`,
  `tenant.view_model_usage`); `tenant_model_provider_configurations` gets
  select-only RLS (credential-bearing).
- `supabase/migrations/<ts+2>_tool_gateway_platform_catalog.sql` — the
  three Tool Gateway platform tables.
- `supabase/migrations/<ts+3>_tenant_tool_gateway.sql` — the five tenant
  tables plus the additive `agent_tool_permissions.tenant_tool_id` column;
  two new permission keys (`tenant.manage_tools`, `tenant.manage_credentials`);
  `tenant_tool_credentials`/`tool_invocations`/`tool_invocation_attempts`/
  `tool_execution_events` get select-only RLS.
- Matching rollback files under `supabase/migrations_rollback/`, applied
  in exact reverse order.

Apply order: model platform catalog → tenant model gateway → tool
platform catalog → tenant tool gateway (references
`tenant_agents`/`workflow_runs`/`workflow_steps`/`policy_evaluations`/
`approval_requests`, all already existing — no change to any of them).

## Complete RLS policy outline

See `PHASE_5_MODEL_TOOL_GATEWAYS.md` §2/§5b for the literal SQL. Summary:
platform tables read-only for any authenticated user (draft/unpublished
rows never visible); `tenant_model_policies`/`tenant_tools` use the
standard select-member/write-admin pair; every table that carries a
`CredentialReference` (`tenant_model_provider_configurations`,
`tenant_tool_credentials`) and every execution-record table
(`model_invocations`, `model_invocation_attempts`, `model_usage_ledger`,
`tool_invocations`, `tool_invocation_attempts`, `tool_execution_events`)
is **select-only for every tenant role — no insert/update/delete policy
of any kind**. Mutation happens exclusively through governed application
commands or the trusted worker connection, the exact Decision-3 pattern
Phase 4 established for `approval_requests`/`approval_decisions`.

## Model/Tool Gateway test cases

Against real local Postgres, restricted `authenticated` role, mirroring
the exact pattern proven in Phases 2–4 — see
`PHASE_5_MODEL_TOOL_GATEWAYS.md` §17 for the complete test matrix (not
duplicated here). Highlights specific to this phase's new concerns:
deterministic model routing and fallback-eligibility (a fallback model
must have already passed every filter the primary selection did),
budget-exceeded as an explicit result (never a silent downgrade),
governance interception for a governed tool reusing Phase 4's
`recordApprovalDecision` unmodified, credential-reference redaction
(assert no persisted row/event/log ever contains a resolved secret
value), the external-idempotency/uncertain-outcome path for an
irreversible tool's timed-out attempt, direct client mutation attempts
against every credential-bearing and execution-record table explicitly
rejected, and the full reference-workflow integration
(`client_solution_assessment` v1.2.0) through model invocation, tool
invocations, and the existing governance gate to `COMPLETED`.

## Superseded

The Phase 4 content previously in this file is superseded by this Phase 5
revision for the purpose of "what does this file currently describe" — it
remains accurate historical record in git history and
`PHASE_4_GOVERNANCE_APPROVALS.md`'s own file-tree/migration sections, not
restated here.
