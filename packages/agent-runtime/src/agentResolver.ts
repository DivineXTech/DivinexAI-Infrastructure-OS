import type { PlatformAgentCatalog } from "./platformCatalog.js";

/**
 * Implements `workflow-engine`'s `AgentResolver` interface *structurally*
 * (TypeScript's structural typing satisfies it) rather than importing that
 * interface — `agent-runtime` has no dependency on `workflow-engine` at
 * all, keeping the coupling between the two packages strictly one-way in
 * the direction `workflow-engine` doesn't need it: nothing here or
 * elsewhere in `agent-runtime` imports from `@repo/workflow-engine`.
 * Whatever composes `validateWorkflowManifest` (seeding, tests,
 * `apps/worker`) passes an instance of this class in wherever an
 * `AgentResolver` is expected. See
 * `docs/agentflow-v2/PHASE_3_WORKFLOW_RUNTIME.md` §4a.
 */
export class CatalogAgentResolver {
  constructor(private readonly catalog: PlatformAgentCatalog) {}

  async resolveAgentSlug(
    agentSlug: string,
  ): Promise<{ exists: boolean; publishable: boolean }> {
    const definition = await this.catalog.getDefinitionBySlug(agentSlug);
    if (!definition) {
      return { exists: false, publishable: false };
    }
    const published = await this.catalog.listPublishedVersions(definition.id);
    return { exists: true, publishable: published.length > 0 };
  }
}
