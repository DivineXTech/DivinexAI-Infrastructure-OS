/**
 * Resolution seam for `kind: "capability"` workflow steps (manifest.ts) —
 * declared now, alongside `AgentResolver`, so capability-based routing can
 * be introduced later without a manifest schema change. Phase 3 ships no
 * implementation: DAG validation treats every `kind: "capability"` step as
 * structurally valid (a non-empty `capability` string) without calling a
 * resolver, and step materialization only handles `kind: "agentSlug"` steps
 * end-to-end. Introducing real capability routing means implementing this
 * interface against the platform catalog's capability tags and passing it
 * into `validateWorkflowManifest` alongside `AgentResolver` — no other
 * change required.
 */
export interface CapabilityResolutionResult {
  supported: boolean;
  /** The concrete agent slug this capability currently resolves to, or null when unsupported. */
  resolvedAgentSlug: string | null;
}

export interface CapabilityResolver {
  resolveCapability(capability: string): Promise<CapabilityResolutionResult>;
}
