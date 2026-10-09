import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface RecordAuditLogInput {
  actor: string;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogStore {
  record(input: RecordAuditLogInput): Promise<void>;
  list(opts: { limit: number; offset: number }): Promise<{ entries: AuditLogEntry[]; total: number }>;
}

class SupabaseAuditLogStore implements AuditLogStore {
  async record(input: RecordAuditLogInput): Promise<void> {
    const client = getSupabaseAdmin();
    if (!client) return;
    const { error } = await client.from("audit_logs").insert({
      actor: input.actor,
      action: input.action,
      target: input.target ?? null,
      metadata: input.metadata ?? null,
    });
    if (error) console.error("[audit-log] failed to record entry", error);
  }

  async list(opts: {
    limit: number;
    offset: number;
  }): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const client = getSupabaseAdmin();
    if (!client) return { entries: [], total: 0 };
    const { data, error, count } = await client
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1);
    if (error) throw error;
    return {
      entries: (data ?? []).map((row) => ({
        id: row.id,
        actor: row.actor,
        action: row.action,
        target: row.target,
        metadata: row.metadata,
        createdAt: row.created_at,
      })),
      total: count ?? 0,
    };
  }
}

class InMemoryAuditLogStore implements AuditLogStore {
  private entries: AuditLogEntry[] = [];

  async record(input: RecordAuditLogInput): Promise<void> {
    this.entries.unshift({
      id: crypto.randomUUID(),
      actor: input.actor,
      action: input.action,
      target: input.target ?? null,
      metadata: input.metadata ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  async list(opts: {
    limit: number;
    offset: number;
  }): Promise<{ entries: AuditLogEntry[]; total: number }> {
    return {
      entries: this.entries.slice(opts.offset, opts.offset + opts.limit),
      total: this.entries.length,
    };
  }
}

let store: AuditLogStore | null = null;

/**
 * Unlike subscriber/reward stores, this one never throws in production
 * when Supabase isn't configured — losing audit history isn't a reason to
 * take the whole app down, and admin-log writes already degrade gracefully
 * (Supabase client methods above no-op when unconfigured).
 */
export function getAuditLogStore(): AuditLogStore {
  if (!store) {
    store = isSupabaseConfigured() ? new SupabaseAuditLogStore() : new InMemoryAuditLogStore();
  }
  return store;
}
