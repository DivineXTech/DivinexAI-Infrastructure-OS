import type { TenantAgentInstallation } from "./tenantAgentRegistry.js";
import type { TenantAgentLifecycleStatus } from "./tenantAgentLifecycle.js";

/**
 * Ordered eligibility ladder — deliberately excludes `SUSPENDED`, which is
 * reachable from any other status (`tenantAgentLifecycle.ts`) but is never
 * itself eligible to execute regardless of what it was suspended from.
 */
const ELIGIBLE_LIFECYCLE_ORDER: readonly TenantAgentLifecycleStatus[] = [
  "REGISTERED",
  "MOCK_EXECUTABLE",
  "EVALUATION_TESTED",
  "TOOL_ENABLED",
  "APPROVAL_GOVERNED",
  "ACTIVE",
];

const MOCK_EXECUTABLE_INDEX =
  ELIGIBLE_LIFECYCLE_ORDER.indexOf("MOCK_EXECUTABLE");

export class AgentNotEligibleError extends Error {
  constructor(
    public readonly installationId: string,
    public readonly reason: string,
  ) {
    super(
      `Tenant agent installation "${installationId}" is not eligible to execute: ${reason}`,
    );
    this.name = "AgentNotEligibleError";
  }
}

/**
 * Lifecycle eligibility check: an installation may execute (even in mock
 * form) only once it is `enabled` and has cleared at least
 * `MOCK_EXECUTABLE` — never while still `REGISTERED` (registered but not
 * yet validated as executable at all) or `SUSPENDED` (explicitly halted,
 * regardless of how far it had progressed before suspension).
 */
export function assertAgentEligible(
  installation: TenantAgentInstallation,
): void {
  if (!installation.enabled) {
    throw new AgentNotEligibleError(
      installation.id,
      "installation is not enabled",
    );
  }

  const index = ELIGIBLE_LIFECYCLE_ORDER.indexOf(installation.lifecycleStatus);
  if (index < MOCK_EXECUTABLE_INDEX) {
    throw new AgentNotEligibleError(
      installation.id,
      `lifecycle status "${installation.lifecycleStatus}" has not reached MOCK_EXECUTABLE`,
    );
  }
}
