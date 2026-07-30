/**
 * Resolves whether a workflow step's assigned `agentSlug` names a real,
 * publishable platform agent — without `workflow-engine` taking a
 * compile-time dependency on `agent-runtime`'s `CANONICAL_AGENT_SLUGS` (or
 * on `agent-runtime` at all). `agent-runtime` provides the concrete
 * implementation (`CatalogAgentResolver`, backed by `PlatformAgentCatalog`);
 * whatever wires up `validateWorkflowManifest` (seeding, tests,
 * `apps/worker`) supplies it. This is the same inversion already used for
 * `GovernanceGate`.
 *
 * This keeps `workflow-engine` independent of which specific agents exist —
 * a future marketplace, partner, vertical, or tenant-authored agent needs no
 * change here, only an `AgentResolver` implementation that knows about it.
 */
export interface AgentResolutionResult {
  exists: boolean;
  /** Has at least one published version. */
  publishable: boolean;
}

export interface AgentResolver {
  resolveAgentSlug(agentSlug: string): Promise<AgentResolutionResult>;
}
