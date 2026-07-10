import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

export interface AuditLogInput {
  actorId: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeState?: Json | null;
  afterState?: Json | null;
  metadata?: Json;
}

/**
 * Writes an append-only audit log row using the service-role client. Call
 * this for every material admin action and every state-changing commerce
 * event (order created, product approved/rejected, refund issued, role
 * granted, payout initiated, etc.) — see SECURITY.md for the full list.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: input.actorId,
    actor_role: input.actorRole ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) {
    // Audit logging must never crash the primary operation, but it must be
    // visible in server logs for investigation.
    console.error("[audit] failed to write audit log", { action: input.action, error });
  }
}
