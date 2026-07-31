# ADR-0016: Tool Registry Architecture and Credential Resolution

**Status:** Proposed — Phase 5 planning gate (see `../PHASE_5_MODEL_TOOL_GATEWAYS.md`)

## Context

`CAPABILITY_PACKAGE_MAPPING.md` already names `packages/tool-registry` as
the canonical home for tool contracts and the execution pipeline
("not started" until now). Phase 2 anticipated tenant-agent tool
permissions with a placeholder table (`agent_tool_permissions`, `tool_id
text` with a comment "references tool_definitions once Phase 5 exists")
but never a real tool catalog. `ADR-0007` deferred the credential-storage
mechanism explicitly "to Phase 4, when the first real tool adapter needing
tenant credentials is built" — that moment is now, in Phase 5, not Phase 4
(Phase 4 needed no tenant credentials at all; governance's approvals are
purely internal state).

A model must never execute a tool directly — the brief's required path is
`Agent -> Model Gateway -> structured proposed action -> Governance ->
Tool Gateway -> external adapter`. This ADR records where governance and
approval fit into that path without duplicating Phase 4's already-tested
machinery.

## Decision

### Tool registry: a new top-level package, `packages/tool-registry`

Mirrors `workflow-engine`/`governance`'s established package shape
exactly: platform-owned `tool_definitions`/`tool_versions` (immutable
manifest metadata once published, same hash-guard discipline as every
other versioned catalog), tenant-owned `tenant_tools` (pinned to an
explicit published version, never "latest"), `tool_invocations`/
`tool_invocation_attempts`/`tool_execution_events` (the durable execution
record, sequence-locked events mirroring `workflow_execution_events`).
Full DDL and RLS in `PHASE_5_MODEL_TOOL_GATEWAYS.md` §5.

### Tool-invocation governance and approval reuse Phase 4 verbatim

A tool version that declares a `governedAction` routes through the exact
same `governance.evaluatePolicy`/`createApprovalRequest`/
`recordApprovalDecision` functions Phase 4 built and tested — no new
approval-request schema, no second approval mechanism.
`tool_invocations.policy_evaluation_id`/`approval_request_id` are
composite-FK references into `governance`'s existing tables, the same
one-way reference pattern `approval_requests` already uses toward
`workflow_steps`. When approval is required, `tool-registry` calls
`workflow-engine.enterWaitingForApproval`/`resumeWorkflowStepAfterApproval`
— the identical functions Phase 4 built — parking the _workflow step_ that
requested the tool call, not inventing a separate "tool step" wait state.

This makes `tool-registry -> governance -> workflow-engine` and
`tool-registry -> workflow-engine` new one-way dependency edges; neither
`governance` nor `workflow-engine` gains any dependency on `tool-registry`.

### `agent_tool_permissions` (Phase 2) is extended, not duplicated

Rather than create a second table for the brief's `AgentToolGrant`
concept, `agent_tool_permissions` gains an additive
`tenant_tool_id uuid references tenant_tools (id)` column and becomes the
`AgentToolGrant` record. Its Phase 2 `tool_id text` column (never
populated in any real environment — a forward reference with no working
FK) is left in place, documented as deprecated, not dropped — no
destructive migration. Flagged in `PHASE_5_MODEL_TOOL_GATEWAYS.md` §19
item 1 for explicit confirmation before implementation.

### Credential model: `CredentialReference` + pluggable `CredentialResolver`

Finalizes `ADR-0007`'s deferred mechanism (see that ADR's addendum,
appended alongside this one): a `CredentialReference` (id, provider type,
secret-manager type, locator, version, scope, status, rotation metadata)
is what gets stored in `tenant_model_provider_configurations`/
`tenant_tool_credentials` — never a plaintext secret. A `CredentialResolver`
interface resolves a reference to an in-memory `ResolvedCredential` for
the duration of exactly one adapter call. Phase 5 ships one implementation,
`EnvCredentialResolver` (locator = environment variable name), sufficient
for local development and the mock adapters; a Supabase-Vault-backed or
KMS-backed resolver is a swappable future implementation behind the same
interface, chosen when a real integration needs it — not built
speculatively now.

Adapters receive only `ToolExecutionContext` (tenant ID, trace ID,
timeout, the already-resolved credential) — never the raw tenant row,
workflow context, or a `CredentialReference` locator they'd have to
resolve themselves. This is both a security boundary (least-privilege
adapter input, the brief's explicit requirement) and what makes secret
redaction structurally enforceable: nothing downstream of "the adapter
call returns" ever holds the resolved value.

### Placement: `packages/shared/src/credentials.ts`

The `CredentialReference` type, `CredentialResolver` interface, and
`EnvCredentialResolver` live in `packages/shared`, not `tool-registry` or
`agent-runtime` — both packages need the identical abstraction (tool
credentials and model-provider credentials are the same concept), and
neither owns it more than the other. This mirrors why
`PgTenantAccessEvaluator` lives in `packages/shared` rather than being
duplicated per consuming package. Flagged in
`PHASE_5_MODEL_TOOL_GATEWAYS.md` §19 item 3 for explicit confirmation,
since `packages/shared`'s standing rule is that it does not grow by
default — this is presented as the one case that meets
`CAPABILITY_PACKAGE_MAPPING.md`'s own bar for an exception (identical need
across two capability packages, no single clear owner), not as a
convenience.

### Uncertain external outcomes are a first-class, structured state

A tool call that times out or drops its connection after the external
system may have already applied an **irreversible** side effect is never
auto-retried and never silently marked failed — it is recorded with a
status reserved for manual reconciliation. `reversible`/`read_only` tools
may auto-retry per their declared policy; this distinction lives on
`tool_versions.side_effect_classification`, checked by recovery before any
retry decision. None of Phase 5's four required mock tools are
irreversible (§13 of the design doc), so this path is built and tested,
not exercised by the reference workflow's happy path.

## Consequences

- Adding a new tool in a later phase means one new manifest + adapter
  file under `tool-registry/src/adapters/`, seeded through
  `seedPlatformToolCatalog` — no schema change, no new approval mechanism,
  no new credential mechanism.
- A real, side-effecting, high-risk tool (payments, external
  communication, production deployment) is explicitly out of scope for
  Phase 5 — this ADR's execution/governance/credential architecture is
  designed to carry that weight later without another architectural
  change, but none of Phase 5's shipped tools exercise the irreversible
  path for real.
- `packages/shared` gains exactly one new file, reviewed against
  `CAPABILITY_PACKAGE_MAPPING.md`'s explicit criteria before landing, not
  added by default convenience.

## Alternatives considered

- **A tool-specific approval-request schema, parallel to Phase 4's** —
  rejected: duplicates a fully-tested mechanism for no functional gain,
  and creates exactly the "second authorization/approval path" the
  standing rules prohibit.
- **`agent_tool_grants` as a brand-new table alongside the unused
  `agent_tool_permissions`** — rejected: two tables for one concept,
  with the older one dead weight; extending in place is additive and
  keeps the concept singular.
- **Credential resolution duplicated in both `agent-runtime` and
  `tool-registry`** — rejected: identical logic maintained twice is the
  drift risk `ADR-0014`'s reasoning already warned against for a
  different (but structurally identical) placement question.

## Related

- `ADR-0007` — the credential-storage decision this ADR's addendum finalizes.
- `ADR-0014` — precedent for "is this narrow-but-shared concern a new
  package, an existing package, or `packages/shared`," resolved
  differently here because the concern (credential resolution) genuinely
  has no single capability owner, unlike content-hashing.
- `PHASE_4_GOVERNANCE_APPROVALS.md` — the approval-request machinery this
  ADR reuses rather than duplicates.
- `PHASE_5_MODEL_TOOL_GATEWAYS.md` — full design, all cross-references above.
