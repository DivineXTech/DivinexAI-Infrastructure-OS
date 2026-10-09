import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export interface EmailLogEntry {
  id: string;
  subscriberId: string | null;
  emailType: string;
  toEmail: string;
  delivered: boolean;
  simulated: boolean;
  error: string | null;
  createdAt: string;
}

export interface RecordEmailLogInput {
  subscriberId?: string | null;
  emailType: string;
  toEmail: string;
  delivered: boolean;
  simulated: boolean;
  error?: string | null;
}

export interface EmailLogStore {
  record(input: RecordEmailLogInput): Promise<void>;
  list(opts: { limit: number; offset: number }): Promise<{ entries: EmailLogEntry[]; total: number }>;
}

class SupabaseEmailLogStore implements EmailLogStore {
  async record(input: RecordEmailLogInput): Promise<void> {
    const client = getSupabaseAdmin();
    if (!client) return;
    const { error } = await client.from("email_logs").insert({
      subscriber_id: input.subscriberId ?? null,
      email_type: input.emailType,
      to_email: input.toEmail,
      delivered: input.delivered,
      simulated: input.simulated,
      error: input.error ?? null,
    });
    if (error) console.error("[email-log] failed to record entry", error);
  }

  async list(opts: {
    limit: number;
    offset: number;
  }): Promise<{ entries: EmailLogEntry[]; total: number }> {
    const client = getSupabaseAdmin();
    if (!client) return { entries: [], total: 0 };
    const { data, error, count } = await client
      .from("email_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1);
    if (error) throw error;
    return {
      entries: (data ?? []).map((row) => ({
        id: row.id,
        subscriberId: row.subscriber_id,
        emailType: row.email_type,
        toEmail: row.to_email,
        delivered: row.delivered,
        simulated: row.simulated,
        error: row.error,
        createdAt: row.created_at,
      })),
      total: count ?? 0,
    };
  }
}

class InMemoryEmailLogStore implements EmailLogStore {
  private entries: EmailLogEntry[] = [];

  async record(input: RecordEmailLogInput): Promise<void> {
    this.entries.unshift({
      id: crypto.randomUUID(),
      subscriberId: input.subscriberId ?? null,
      emailType: input.emailType,
      toEmail: input.toEmail,
      delivered: input.delivered,
      simulated: input.simulated,
      error: input.error ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  async list(opts: {
    limit: number;
    offset: number;
  }): Promise<{ entries: EmailLogEntry[]; total: number }> {
    return {
      entries: this.entries.slice(opts.offset, opts.offset + opts.limit),
      total: this.entries.length,
    };
  }
}

let store: EmailLogStore | null = null;

/** Same non-throwing-in-production rationale as audit-log-store.ts. */
export function getEmailLogStore(): EmailLogStore {
  if (!store) {
    store = isSupabaseConfigured() ? new SupabaseEmailLogStore() : new InMemoryEmailLogStore();
  }
  return store;
}
