import { z } from "zod";

/**
 * Tenant-side runtime lifecycle for a `tenant_agents` installation row —
 * distinct from `AgentVersionStatus` (agentVersionLifecycle.ts). There is
 * no `DEFINED` state here: that describes creation of the platform
 * definition/version, not a tenant's own installation, which always starts
 * at `REGISTERED`. See `ADR-0013`'s addendum.
 */
export const TenantAgentLifecycleStatusSchema = z.enum([
  "REGISTERED",
  "MOCK_EXECUTABLE",
  "EVALUATION_TESTED",
  "TOOL_ENABLED",
  "APPROVAL_GOVERNED",
  "ACTIVE",
  "SUSPENDED",
]);
export type TenantAgentLifecycleStatus = z.infer<
  typeof TenantAgentLifecycleStatusSchema
>;

/**
 * `ACTIVE` is reachable only by walking the full ordered sequence — no
 * skipping a stage — per the brief's requirement that agents "must not be
 * marked active until they pass their required evaluation thresholds" and
 * are never unrestricted autonomous actors from the moment they're
 * installed. `SUSPENDED` is reachable from any state past `REGISTERED`;
 * resuming from `SUSPENDED` returns only to `ACTIVE` (a suspended agent is
 * assumed to have already cleared every earlier gate).
 */
const ALLOWED_TRANSITIONS: Record<
  TenantAgentLifecycleStatus,
  readonly TenantAgentLifecycleStatus[]
> = {
  REGISTERED: ["MOCK_EXECUTABLE"],
  MOCK_EXECUTABLE: ["EVALUATION_TESTED", "SUSPENDED"],
  EVALUATION_TESTED: ["TOOL_ENABLED", "SUSPENDED"],
  TOOL_ENABLED: ["APPROVAL_GOVERNED", "SUSPENDED"],
  APPROVAL_GOVERNED: ["ACTIVE", "SUSPENDED"],
  ACTIVE: ["SUSPENDED"],
  SUSPENDED: ["ACTIVE"],
};

export function isValidTenantAgentTransition(
  from: TenantAgentLifecycleStatus,
  to: TenantAgentLifecycleStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidTenantAgentTransitionError extends Error {
  constructor(
    public readonly from: TenantAgentLifecycleStatus,
    public readonly to: TenantAgentLifecycleStatus,
  ) {
    super(`Invalid tenant agent lifecycle transition: ${from} -> ${to}`);
    this.name = "InvalidTenantAgentTransitionError";
  }
}

export function assertValidTenantAgentTransition(
  from: TenantAgentLifecycleStatus,
  to: TenantAgentLifecycleStatus,
): void {
  if (!isValidTenantAgentTransition(from, to)) {
    throw new InvalidTenantAgentTransitionError(from, to);
  }
}
