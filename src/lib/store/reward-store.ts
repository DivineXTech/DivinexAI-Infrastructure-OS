import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { isRunningInProduction, isSupabaseConfigured } from "@/lib/env";
import type {
  CreateRewardGrantInput,
  RewardGrant,
  RewardGrantStatus,
} from "@/lib/store/reward-types";

/**
 * Reward grant persistence — same Supabase-or-in-memory pattern as
 * subscriber-store.ts. See that file for the rationale.
 */
export interface RewardStore {
  getGrant(subscriberId: string, milestoneId: string): Promise<RewardGrant | null>;
  /** Idempotent: if a grant already exists for this (subscriber, milestone), returns it unchanged. */
  createGrantIfNotExists(
    input: CreateRewardGrantInput,
  ): Promise<{ grant: RewardGrant; created: boolean }>;
  listGrantsForSubscriber(subscriberId: string): Promise<RewardGrant[]>;
  listAll(opts: { status?: RewardGrantStatus; limit: number; offset: number }): Promise<{
    grants: RewardGrant[];
    total: number;
  }>;
  /**
   * Transitions a grant's status. Fulfillment is idempotent: calling this
   * with status "fulfilled" on an already-fulfilled grant is a no-op (the
   * original fulfilledAt is preserved, not overwritten).
   */
  updateGrantStatus(
    id: string,
    changes: {
      status: RewardGrantStatus;
      approvedBy?: string;
      deniedReason?: string;
    },
  ): Promise<RewardGrant | null>;
}

type RewardGrantRow = Database["public"]["Tables"]["reward_grants"]["Row"];

function rowToGrant(row: RewardGrantRow): RewardGrant {
  return {
    id: row.id,
    subscriberId: row.subscriber_id,
    milestoneId: row.milestone_id,
    qualifiedCountAtGrant: row.qualified_count_at_grant,
    status: row.status,
    fraudFlag: row.fraud_flag,
    fraudReason: row.fraud_reason,
    deniedReason: row.denied_reason,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    fulfilledAt: row.fulfilled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class SupabaseRewardStore implements RewardStore {
  private client() {
    const client = getSupabaseAdmin();
    if (!client) throw new Error("Supabase admin client is not configured.");
    return client;
  }

  async getGrant(subscriberId: string, milestoneId: string): Promise<RewardGrant | null> {
    const { data, error } = await this.client()
      .from("reward_grants")
      .select("*")
      .eq("subscriber_id", subscriberId)
      .eq("milestone_id", milestoneId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToGrant(data) : null;
  }

  async createGrantIfNotExists(
    input: CreateRewardGrantInput,
  ): Promise<{ grant: RewardGrant; created: boolean }> {
    const existing = await this.getGrant(input.subscriberId, input.milestoneId);
    if (existing) return { grant: existing, created: false };

    const { data, error } = await this.client()
      .from("reward_grants")
      .insert({
        subscriber_id: input.subscriberId,
        milestone_id: input.milestoneId,
        qualified_count_at_grant: input.qualifiedCountAtGrant,
        status: input.status,
        fraud_flag: input.fraudFlag,
        fraud_reason: input.fraudReason,
        fulfilled_at: input.status === "fulfilled" ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    // Unique-constraint race: another request created it between our read
    // and write. Treat as "already exists" rather than an error.
    if (error?.code === "23505") {
      const grant = await this.getGrant(input.subscriberId, input.milestoneId);
      if (grant) return { grant, created: false };
    }
    if (error) throw error;
    return { grant: rowToGrant(data), created: true };
  }

  async listGrantsForSubscriber(subscriberId: string): Promise<RewardGrant[]> {
    const { data, error } = await this.client()
      .from("reward_grants")
      .select("*")
      .eq("subscriber_id", subscriberId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToGrant);
  }

  async listAll(opts: {
    status?: RewardGrantStatus;
    limit: number;
    offset: number;
  }): Promise<{ grants: RewardGrant[]; total: number }> {
    let query = this.client()
      .from("reward_grants")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1);
    if (opts.status) query = query.eq("status", opts.status);

    const { data, error, count } = await query;
    if (error) throw error;
    return { grants: (data ?? []).map(rowToGrant), total: count ?? 0 };
  }

  async updateGrantStatus(
    id: string,
    changes: { status: RewardGrantStatus; approvedBy?: string; deniedReason?: string },
  ): Promise<RewardGrant | null> {
    const existing = await this.client()
      .from("reward_grants")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return null;

    // Idempotent fulfillment: don't clobber an already-fulfilled grant.
    if (existing.data.status === "fulfilled") {
      return rowToGrant(existing.data);
    }

    const now = new Date().toISOString();
    const { data, error } = await this.client()
      .from("reward_grants")
      .update({
        status: changes.status,
        approved_by: changes.status === "approved" ? (changes.approvedBy ?? "admin") : existing.data.approved_by,
        approved_at: changes.status === "approved" ? now : existing.data.approved_at,
        denied_reason: changes.status === "denied" ? (changes.deniedReason ?? null) : existing.data.denied_reason,
        fulfilled_at: changes.status === "fulfilled" ? now : existing.data.fulfilled_at,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return rowToGrant(data);
  }
}

class InMemoryRewardStore implements RewardStore {
  private grants = new Map<string, RewardGrant>();

  private key(subscriberId: string, milestoneId: string) {
    return `${subscriberId}:${milestoneId}`;
  }

  async getGrant(subscriberId: string, milestoneId: string): Promise<RewardGrant | null> {
    return this.grants.get(this.key(subscriberId, milestoneId)) ?? null;
  }

  async createGrantIfNotExists(
    input: CreateRewardGrantInput,
  ): Promise<{ grant: RewardGrant; created: boolean }> {
    const key = this.key(input.subscriberId, input.milestoneId);
    const existing = this.grants.get(key);
    if (existing) return { grant: existing, created: false };

    const now = new Date().toISOString();
    const grant: RewardGrant = {
      id: crypto.randomUUID(),
      subscriberId: input.subscriberId,
      milestoneId: input.milestoneId,
      qualifiedCountAtGrant: input.qualifiedCountAtGrant,
      status: input.status,
      fraudFlag: input.fraudFlag,
      fraudReason: input.fraudReason,
      deniedReason: null,
      approvedBy: null,
      approvedAt: null,
      fulfilledAt: input.status === "fulfilled" ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    this.grants.set(key, grant);
    return { grant, created: true };
  }

  async listGrantsForSubscriber(subscriberId: string): Promise<RewardGrant[]> {
    return [...this.grants.values()]
      .filter((g) => g.subscriberId === subscriberId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listAll(opts: {
    status?: RewardGrantStatus;
    limit: number;
    offset: number;
  }): Promise<{ grants: RewardGrant[]; total: number }> {
    let all = [...this.grants.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (opts.status) all = all.filter((g) => g.status === opts.status);
    return { grants: all.slice(opts.offset, opts.offset + opts.limit), total: all.length };
  }

  async updateGrantStatus(
    id: string,
    changes: { status: RewardGrantStatus; approvedBy?: string; deniedReason?: string },
  ): Promise<RewardGrant | null> {
    const grant = [...this.grants.values()].find((g) => g.id === id);
    if (!grant) return null;
    if (grant.status === "fulfilled") return grant;

    const now = new Date().toISOString();
    grant.status = changes.status;
    if (changes.status === "approved") {
      grant.approvedBy = changes.approvedBy ?? "admin";
      grant.approvedAt = now;
    }
    if (changes.status === "denied") {
      grant.deniedReason = changes.deniedReason ?? null;
    }
    if (changes.status === "fulfilled") {
      grant.fulfilledAt = now;
    }
    grant.updatedAt = now;
    return grant;
  }
}

let store: RewardStore | null = null;

export function getRewardStore(): RewardStore {
  if (!store) {
    if (!isSupabaseConfigured()) {
      if (isRunningInProduction()) {
        throw new Error(
          "Supabase is not configured in production. Refusing to run the reward " +
            "engine against an in-memory store. See SETUP.md.",
        );
      }
      store = new InMemoryRewardStore();
    } else {
      store = new SupabaseRewardStore();
    }
  }
  return store;
}
