import { z } from "zod";

/**
 * Closed catalog of Phase 4's 19 named, namespaced (`domain.resource.verb`)
 * governed actions (§3a of the Phase 4 design). No arbitrary action string
 * is ever accepted at a runtime evaluation boundary — every call site
 * parses through `GovernedActionSchema` (or the literal `"*"`, reserved for
 * platform-mandatory catch-all policies/risk defaults) and rejects
 * anything else.
 *
 * Future vertical-namespace extension (documented, not built in Phase 4):
 * Phase 11's vertical-OS marketplace will need namespaced actions per
 * vertical (e.g. `restaurant-os.order.refund`) this closed enum can't
 * express. Every table already stores the action as a plain `text`/string
 * field, so replacing this enum with a registry-backed validator
 * (`isRegisteredGovernedAction`) at that point requires no schema
 * migration, only a validator change at this boundary.
 */
export const GOVERNED_ACTIONS = [
  "code.deploy.production",
  "database.execute.destructive",
  "security.policy.modify",
  "permission.modify",
  "secret.access",
  "secret.rotate",
  "communication.send.external",
  "content.publish.external",
  "contract.commit",
  "pricing.modify",
  "billing.modify",
  "refund.issue",
  "payment.initiate",
  "payout.initiate",
  "data.export",
  "data.delete",
  "workflow.override",
  "agent.activate",
  "agent.permission.modify",
] as const;

export const GovernedActionSchema = z.enum(GOVERNED_ACTIONS);
export type GovernedAction = z.infer<typeof GovernedActionSchema>;

/** `"*"` is reserved for platform-wide default policies/risk classifications — never a real action a step declares. */
export const GovernedActionOrWildcardSchema = z.union([
  GovernedActionSchema,
  z.literal("*"),
]);
export type GovernedActionOrWildcard = z.infer<
  typeof GovernedActionOrWildcardSchema
>;

export function isGovernedAction(value: string): value is GovernedAction {
  return (GOVERNED_ACTIONS as readonly string[]).includes(value);
}
