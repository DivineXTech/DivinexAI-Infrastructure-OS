import { z } from "zod";

/**
 * Lifecycle for a `policy_versions` row — structurally identical to
 * `agent-runtime`'s `AgentVersionStatus`/`workflow-engine`'s
 * `WorkflowVersionStatus` but declared independently here, per the same
 * reasoning already established for those packages: each package owns its
 * own versioning vocabulary even where the shape matches exactly. A
 * version's `policy_document` is immutable once `published`; a changed
 * document must create a new version rather than mutate this one.
 */
export const PolicyVersionStatusSchema = z.enum([
  "draft",
  "validated",
  "published",
  "deprecated",
  "retired",
]);
export type PolicyVersionStatus = z.infer<typeof PolicyVersionStatusSchema>;

const ALLOWED_TRANSITIONS: Record<
  PolicyVersionStatus,
  readonly PolicyVersionStatus[]
> = {
  draft: ["validated"],
  validated: ["draft", "published"],
  published: ["deprecated"],
  deprecated: ["retired"],
  retired: [],
};

export function isValidPolicyVersionTransition(
  from: PolicyVersionStatus,
  to: PolicyVersionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidPolicyVersionTransitionError extends Error {
  constructor(
    public readonly from: PolicyVersionStatus,
    public readonly to: PolicyVersionStatus,
  ) {
    super(`Invalid policy version status transition: ${from} -> ${to}`);
    this.name = "InvalidPolicyVersionTransitionError";
  }
}

export function assertValidPolicyVersionTransition(
  from: PolicyVersionStatus,
  to: PolicyVersionStatus,
): void {
  if (!isValidPolicyVersionTransition(from, to)) {
    throw new InvalidPolicyVersionTransitionError(from, to);
  }
}
