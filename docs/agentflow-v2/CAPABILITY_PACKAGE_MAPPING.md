# Capability → Package Mapping

Canonical reference for where a given capability's code lives. The eight
top-level packages (`ADR-0001`) are not renamed, split, or added to; incoming
briefs that name capability areas (contracts, agents, model-gateway,
orchestration, workflows, tool-gateway, memory, policies, approvals,
security, evaluations, observability, database) describe **where inside
these eight packages work goes**, not new top-level packages. See
`BRIEF_RECONCILIATION.md` for how this was decided and `ADR-0013` for the
formal record.

| Capability area                                        | Package                                                                  | Notes                                                                                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts (agent manifest, execution context/result)   | `agent-runtime`                                                          | Built: `packages/agent-runtime/src/{manifest,executionContext,executionResult}.ts`                                                                                                                                              |
| Agents (registry, six initial manifests)               | `agent-runtime`                                                          | Registry + concrete manifests are Phase 2                                                                                                                                                                                       |
| Model gateway (provider adapters, routing, fallback)   | `agent-runtime`                                                          | Not started; canonical location per `IMPLEMENTATION_PLAN.md` §4 (`ModelProvider`, `AgentProvider`, provider routing)                                                                                                            |
| Orchestration (assignment, handoffs, dependency graph) | `workflow-engine`                                                        | Not started                                                                                                                                                                                                                     |
| Workflows (registry, state machine, execution ledger)  | `workflow-engine`                                                        | Built: `packages/workflow-engine/src/status.ts` (statuses + transitions only — no persistence/engine yet)                                                                                                                       |
| Tool gateway (tool definitions, execution pipeline)    | `tool-registry`                                                          | Not started                                                                                                                                                                                                                     |
| Memory (working/episodic/semantic)                     | `memory-engine`                                                          | Not started                                                                                                                                                                                                                     |
| Policies (deterministic evaluation)                    | `governance`                                                             | Building block exists in `packages/shared/src/policy.ts` (`PgTenantAccessEvaluator`) — stays in `packages/shared` for now (see "On packages/shared" below); `governance` will own the full policy engine when Phase 4 builds it |
| Approvals (approval request lifecycle)                 | `governance`                                                             | Not started                                                                                                                                                                                                                     |
| Security (auth/authz utilities beyond tenancy)         | `governance`, plus existing `packages/shared` tenancy/security utilities | `assertTenantMembership`/`assertTenantPermission` stay in `packages/shared`; new non-tenancy security logic (e.g. tool-permission checks specific to governance) goes in `governance`                                           |
| Evaluations (schema validity, task completion, etc.)   | `observability`                                                          | Not started                                                                                                                                                                                                                     |
| Observability (traces, cost, usage, dashboards)        | `observability`                                                          | Narrow start: `packages/shared/src/events.ts` + `audit_events`/`security_events` tables — full observability layer (latency, tokens, cost, evaluation scores) is Phase 9                                                        |
| Database (schema, migrations)                          | Top-level `supabase/migrations/` + package-local query code              | No `packages/database` — each package owns the query/repository code for the tables it's responsible for; the schema itself is not package-scoped                                                                               |

## On `packages/shared`

Per explicit instruction, `packages/shared` is not being turned into a
capability-mapped package, and it is not being broadly refactored to empty
it out into the eight packages above. Its existing, tested code
(`types.ts`, `env.ts`, `supabase.ts`, `tenant.ts`, `db.ts`, `policy.ts`,
`featureFlags.ts`, `tenantSettings.ts`, `events.ts`) stays exactly where it
is. Future code moves out of it only when:

1. A concrete package (e.g. `governance`) has a clear, specific reason to
   own a piece of it, and
2. The move preserves the existing public interface where practical, and
3. Test coverage is retained or improved by the move, not lost.

New capability work (agent runtime, workflow engine, tool registry, memory
engine, governance, sara, vertical-os-sdk, observability) is written
directly into its correct package from the start, so `packages/shared` does
not keep growing as a default location for new code.
