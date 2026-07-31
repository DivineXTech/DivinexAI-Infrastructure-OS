import type { ActionSnapshot } from "./createApprovalRequest.js";

export interface DeciderActor {
  type: "user" | "agent" | "system" | "worker";
  id: string;
}

export class SelfApprovalProhibitedError extends Error {
  constructor(deciderId: string) {
    super(
      `Actor "${deciderId}" cannot decide an approval request it (or its tenant agent) requested — separation of duties`,
    );
    this.name = "SelfApprovalProhibitedError";
  }
}

/**
 * Pure eligibility check (§7 step 3): a decider may never be the requesting
 * actor, the requesting tenant agent, or the same delegated service
 * identity. Pure and independently testable without a database.
 */
export function assertSeparationOfDuties(
  snapshot: ActionSnapshot,
  decider: DeciderActor,
): void {
  const isRequestingActor =
    snapshot.requestingActor.type === decider.type &&
    snapshot.requestingActor.id === decider.id;

  const isRequestingTenantAgent =
    snapshot.requestingTenantAgentId !== null &&
    decider.type === "agent" &&
    snapshot.requestingTenantAgentId === decider.id;

  if (isRequestingActor || isRequestingTenantAgent) {
    throw new SelfApprovalProhibitedError(decider.id);
  }
}
