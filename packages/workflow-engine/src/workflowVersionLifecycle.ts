import { z } from "zod";

/**
 * Platform-side lifecycle for a `workflow_versions` row — structurally
 * identical to agent-runtime's `AgentVersionStatus` but declared
 * independently here, per the same reasoning ADR-0013's addendum already
 * established for agents: each package owns its own versioning vocabulary
 * even where the shape happens to match. A version's manifest content is
 * immutable once `published`; a changed manifest must create a new version
 * rather than mutate this one.
 */
export const WorkflowVersionStatusSchema = z.enum([
  "draft",
  "validated",
  "published",
  "deprecated",
  "retired",
]);
export type WorkflowVersionStatus = z.infer<typeof WorkflowVersionStatusSchema>;

const ALLOWED_TRANSITIONS: Record<
  WorkflowVersionStatus,
  readonly WorkflowVersionStatus[]
> = {
  draft: ["validated"],
  validated: ["draft", "published"],
  published: ["deprecated"],
  deprecated: ["retired"],
  retired: [],
};

export function isValidWorkflowVersionTransition(
  from: WorkflowVersionStatus,
  to: WorkflowVersionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidWorkflowVersionTransitionError extends Error {
  constructor(
    public readonly from: WorkflowVersionStatus,
    public readonly to: WorkflowVersionStatus,
  ) {
    super(`Invalid workflow version status transition: ${from} -> ${to}`);
    this.name = "InvalidWorkflowVersionTransitionError";
  }
}

export function assertValidWorkflowVersionTransition(
  from: WorkflowVersionStatus,
  to: WorkflowVersionStatus,
): void {
  if (!isValidWorkflowVersionTransition(from, to)) {
    throw new InvalidWorkflowVersionTransitionError(from, to);
  }
}
