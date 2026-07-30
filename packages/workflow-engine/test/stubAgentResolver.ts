import type {
  AgentResolver,
  AgentResolutionResult,
} from "../src/agentResolver.js";

/**
 * In-memory stub satisfying `AgentResolver` for tests that don't need a
 * real database-backed platform catalog — keeps workflow-engine's own unit
 * tests independent of agent-runtime (only referenceWorkflow.test.ts, the
 * cross-package integration test, uses the real `CatalogAgentResolver`).
 */
export function createStubAgentResolver(
  publishableSlugs: readonly string[] = [
    "sara",
    "nova",
    "forge",
    "guardian",
    "reven",
    "pulse",
  ],
  existingUnpublishedSlugs: readonly string[] = [],
): AgentResolver {
  const publishable = new Set(publishableSlugs);
  const existingUnpublished = new Set(existingUnpublishedSlugs);
  return {
    async resolveAgentSlug(agentSlug: string): Promise<AgentResolutionResult> {
      if (publishable.has(agentSlug)) {
        return { exists: true, publishable: true };
      }
      if (existingUnpublished.has(agentSlug)) {
        return { exists: true, publishable: false };
      }
      return { exists: false, publishable: false };
    },
  };
}
