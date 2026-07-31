# ADR-0015: Model Provider Gateway

**Status:** Proposed — Phase 5 planning gate (see `../PHASE_5_MODEL_TOOL_GATEWAYS.md`)

## Context

Phases 1–4 built agent contracts, the workflow runtime, and governance
without ever actually calling a language model — `DeterministicMockAgentAdapter`
fabricates a schema-valid `AgentExecutionResult` directly, with no model
invocation, routing, or provider concept anywhere in the codebase.
`ADR-0002` already commits to model neutrality at the _orchestration_
level (no hard dependency on Google ADK); Phase 5 needs the equivalent
commitment at the _inference_ level: no agent, workflow step, or business
module may import a provider SDK or hard-code a provider/model choice.

`RISK_REGISTER.md` row 22 flagged this exact risk in advance: "real-provider
integration code in Phase 5 grows on top of [the mock adapter] instead of
replacing it, leaking mock behavior into production paths."

## Decision

A new Model Gateway lives entirely inside `packages/agent-runtime`
(no new top-level package — `CAPABILITY_PACKAGE_MAPPING.md` already names
`agent-runtime` as the canonical home for "model gateway (provider
adapters, routing, fallback)"), structured as:

- **`ModelProviderAdapter`** — one interface, one implementation per
  provider (`invoke(request, model) -> ModelInvocationResult`). Phase 5
  ships exactly one: the mock model provider. A real adapter (e.g.
  Anthropic) is a **documented, unbuilt seam**
  (`packages/agent-runtime/providers/anthropic/`) — proposed, not
  implemented, per `PHASE_5_MODEL_TOOL_GATEWAYS.md` §13 and §19 item 4.
- **`ModelProviderRegistry`** — resolves eligible providers/models from
  the platform + tenant catalog; never a hard-coded provider list.
- **`ModelRoutingPolicy`** — a deterministic ranking function, structurally
  identical in spirit to `governance`'s `evaluatePolicy` merge algorithm
  (Phase 4): filter by mandatory restriction, then tenant policy, then
  capability/schema/context/cost, then rank by declared priority and cost,
  never an LLM-driven routing decision.
- **`invokeModel`** — the single orchestration entry point every agent
  invocation goes through; persists `model_invocations`/
  `model_invocation_attempts` before and after calling the adapter (§10 of
  the design doc), enforcing budgets and recording usage regardless of
  which provider was selected.

**The existing agent-execution contract (`AgentExecutionResult`,
`AgentAdapter.execute`) does not change.** Model Gateway integration is an
internal implementation detail of _how_ a real (or model-backed mock)
adapter produces its result — `workflow-engine` and `apps/worker`'s calling
convention is unchanged from Phase 3/4. This is the direct fix for
`RISK_REGISTER.md` row 22: the Model Gateway is a distinct, swappable
layer _underneath_ the existing adapter contract, not a wrapper grown on
top of `DeterministicMockAgentAdapter`, which itself is left untouched for
any test that doesn't need real routing/persistence behavior.

**No hard-coded agent-to-provider binding.** An agent's manifest may
express `requiredCapabilities`/`providerRestrictions` as data; it never
imports a provider adapter or names a specific model. Sara, Forge, and
every other agent are routed identically.

**Fallback never weakens a requirement.** The fallback sequence is a
suffix of the same filtered-and-ranked candidate list the primary
selection came from — never a separately, more permissively computed list.

**No private chain-of-thought is ever persisted.** `ModelInvocationAttempt`'s
schema has no field for raw provider reasoning/hidden output; an adapter
must discard it before constructing the record.

## Consequences

- Real provider integration in a later phase means adding one new file
  under `providers/<name>/` implementing `ModelProviderAdapter` and
  registering it — no change to routing, persistence, budget enforcement,
  or any calling code.
- The standard test suite runs entirely against the mock provider; no
  network access or live credentials required to pass CI.
- `packages/shared/src/credentials.ts` (per `PHASE_5_MODEL_TOOL_GATEWAYS.md`
  §7, §19 item 3) is a dependency of this gateway for resolving
  `tenant_model_provider_configurations.credential_reference` — the
  gateway never receives or stores a raw secret itself; it holds a
  resolved value in memory only for the duration of one adapter call.
- `model_pricing_versions` being immutable once published (mirroring
  `policy_versions`/`risk_classification_versions`, Phase 4) means a
  historical `model_invocations` row's `estimated_cost_usd` remains
  reproducible against the pricing that actually applied, even after
  prices change.

## Alternatives considered

- **Model Gateway as its own top-level package** (`packages/model-gateway`)
  — rejected: `CAPABILITY_PACKAGE_MAPPING.md`/`ADR-0013` already assign
  this capability to `agent-runtime`; a new package would need its own ADR
  amending the taxonomy (the `ADR-0014` precedent), and no distinct
  ownership boundary justifies one — model invocation is inseparable from
  agent execution, unlike `platform-kernel`'s genuinely cross-cutting,
  dependency-free content-hashing concern.
- **Route through `governance.evaluatePolicy` for every model call** —
  rejected per `PHASE_5_MODEL_TOOL_GATEWAYS.md` §8's reasoning: the
  brief's own required-path diagram places `governance` between a model's
  _proposed action_ and the Tool Gateway, not between an agent and the
  Model Gateway; routing restrictions are enforced deterministically
  in-package instead, reserving the full approval-request workflow for
  tool invocations. Flagged as `PHASE_5_MODEL_TOOL_GATEWAYS.md` §19 item 2
  for explicit confirmation.

## Related

- `ADR-0002` — model/orchestration neutrality for Google ADK; this ADR is
  the equivalent commitment one layer lower (inference, not orchestration).
- `ADR-0013`/`ADR-0014` — package taxonomy this ADR does not amend.
- `PHASE_5_MODEL_TOOL_GATEWAYS.md` — full design.
- `RISK_REGISTER.md` row 22 — the risk this ADR's "distinct, swappable
  implementation" decision directly addresses.
