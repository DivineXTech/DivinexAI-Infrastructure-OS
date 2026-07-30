import { z } from "zod";

/**
 * Platform-side lifecycle for an `agent_versions` row — distinct from
 * `TenantAgentLifecycleStatus` (tenantAgentLifecycle.ts). A version's
 * content is immutable once `published`; a changed manifest must create a
 * new version rather than mutate this one. See `ADR-0013`'s addendum.
 */
export const AgentVersionStatusSchema = z.enum([
  "draft",
  "validated",
  "published",
  "deprecated",
  "retired",
]);
export type AgentVersionStatus = z.infer<typeof AgentVersionStatusSchema>;

const ALLOWED_TRANSITIONS: Record<
  AgentVersionStatus,
  readonly AgentVersionStatus[]
> = {
  draft: ["validated"],
  validated: ["draft", "published"],
  published: ["deprecated"],
  deprecated: ["retired"],
  retired: [],
};

export function isValidAgentVersionTransition(
  from: AgentVersionStatus,
  to: AgentVersionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidAgentVersionTransitionError extends Error {
  constructor(
    public readonly from: AgentVersionStatus,
    public readonly to: AgentVersionStatus,
  ) {
    super(`Invalid agent version status transition: ${from} -> ${to}`);
    this.name = "InvalidAgentVersionTransitionError";
  }
}

export function assertValidAgentVersionTransition(
  from: AgentVersionStatus,
  to: AgentVersionStatus,
): void {
  if (!isValidAgentVersionTransition(from, to)) {
    throw new InvalidAgentVersionTransitionError(from, to);
  }
}
