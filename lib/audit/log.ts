import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

/**
 * Closed set of audit action keys — keeps `audit_logs.action` values
 * consistent and greppable instead of ad-hoc strings scattered across the
 * codebase. Extend as new privileged operations are implemented.
 */
export type AuditAction =
  | "tenant.created"
  | "tenant_membership.created"
  | "tenant_membership.role_changed"
  | "tenant_membership.removed"
  | "tenant.switched"
  | "admin.accessed"
  | "privileged_action.denied"
  | "settings.changed";

export type AuditLogEntry = {
  tenantId?: string | null;
  /** Null only for system-initiated events with no human actor. */
  actorProfileId: string | null;
  action: AuditAction;
  targetTable?: string;
  targetId?: string;
  /** Never put secrets, tokens, passwords, or payment details here. */
  metadata?: Record<string, unknown>;
};

/**
 * Writes an audit_logs row using the service-role client, bypassing RLS —
 * this is the one place in the codebase that's expected to do that for
 * this table, matching the "audit_logs has no authenticated insert policy;
 * inserts happen only via server-side/service-role code" design recorded
 * in the foundation migration. Never called from a Client Component
 * (this file is `server-only` transitively via lib/supabase/server.ts).
 *
 * Deliberately fails soft: a broken audit write must never take down the
 * privileged operation it's describing. If `SUPABASE_SERVICE_ROLE_KEY` is
 * unset (e.g. this sandbox's placeholder env), every call logs a console
 * warning instead of writing a row — see docs/SECURITY.md "Known gaps".
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.from("audit_logs").insert({
      tenant_id: entry.tenantId ?? null,
      actor_profile_id: entry.actorProfileId,
      action: entry.action,
      target_table: entry.targetTable ?? null,
      target_id: entry.targetId ?? null,
      metadata: (entry.metadata ?? {}) as Json,
    });
    if (error) {
      console.error("[audit] insert failed", entry.action, error.message);
    }
  } catch (error) {
    console.error("[audit] unavailable, skipping write", entry.action, error);
  }
}
