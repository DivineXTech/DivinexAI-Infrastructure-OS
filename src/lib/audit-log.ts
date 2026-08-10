import "server-only";
import type { AuditLogEntry } from "@/src/types/contract";
import { createSupabaseServiceClient } from "@/src/lib/supabase/server";

/**
 * Appends one immutable audit log row. Every state transition in the
 * pipeline — run created, step started/retried/failed, human approval,
 * publish — must go through this function rather than writing to
 * `audit_log` directly, so there is exactly one code path to review for
 * compliance.
 */
export async function appendAuditLog(
  entry: Omit<AuditLogEntry, "id" | "createdAt">,
): Promise<AuditLogEntry> {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("audit_log")
    .insert({
      run_id: entry.runId,
      node_id: entry.nodeId ?? null,
      actor: typeof entry.actor === "string" ? entry.actor : "user",
      actor_user_id:
        typeof entry.actor === "string" ? null : entry.actor.userId,
      action: entry.action,
      from_status: entry.fromStatus ?? null,
      to_status: entry.toStatus ?? null,
      metadata: entry.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to append audit log entry: ${error.message}`);
  }

  return {
    id: data.id,
    runId: data.run_id,
    nodeId: data.node_id ?? undefined,
    actor: entry.actor,
    action: data.action,
    fromStatus: data.from_status ?? undefined,
    toStatus: data.to_status ?? undefined,
    metadata: data.metadata ?? undefined,
    createdAt: data.created_at,
  };
}
