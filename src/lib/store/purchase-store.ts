import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { isRunningInProduction, isSupabaseConfigured } from "@/lib/env";
import type { Purchase, RecordPurchaseInput } from "@/lib/store/purchase-types";

/**
 * Purchase persistence — same Supabase-or-in-memory pattern as the other
 * stores. `recordIfNotExists` is what makes the Stripe webhook handler
 * idempotent: Stripe redelivers events, and `stripe_session_id` has a
 * unique constraint, so a redelivered `checkout.session.completed` is a
 * no-op here rather than a duplicate purchase/fulfillment.
 */
export interface PurchaseStore {
  findById(id: string): Promise<Purchase | null>;
  findBySessionId(sessionId: string): Promise<Purchase | null>;
  recordIfNotExists(input: RecordPurchaseInput): Promise<{ purchase: Purchase; created: boolean }>;
  markFulfilled(id: string): Promise<{ purchase: Purchase; transitioned: boolean } | null>;
  listAll(opts: { limit: number; offset: number }): Promise<{ purchases: Purchase[]; total: number }>;
}

type PurchaseRow = Database["public"]["Tables"]["purchases"]["Row"];

function rowToPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    subscriberId: row.subscriber_id,
    email: row.email,
    stripeSessionId: row.stripe_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    fulfilledAt: row.fulfilled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class SupabasePurchaseStore implements PurchaseStore {
  private client() {
    const client = getSupabaseAdmin();
    if (!client) throw new Error("Supabase admin client is not configured.");
    return client;
  }

  async findById(id: string): Promise<Purchase | null> {
    const { data, error } = await this.client()
      .from("purchases")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToPurchase(data) : null;
  }

  async findBySessionId(sessionId: string): Promise<Purchase | null> {
    const { data, error } = await this.client()
      .from("purchases")
      .select("*")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToPurchase(data) : null;
  }

  async recordIfNotExists(
    input: RecordPurchaseInput,
  ): Promise<{ purchase: Purchase; created: boolean }> {
    const existing = await this.findBySessionId(input.stripeSessionId);
    if (existing) return { purchase: existing, created: false };

    const { data, error } = await this.client()
      .from("purchases")
      .insert({
        subscriber_id: input.subscriberId,
        email: input.email,
        stripe_session_id: input.stripeSessionId,
        stripe_payment_intent_id: input.stripePaymentIntentId,
        amount_cents: input.amountCents,
        currency: input.currency,
        status: input.status,
      })
      .select("*")
      .single();

    if (error?.code === "23505") {
      const purchase = await this.findBySessionId(input.stripeSessionId);
      if (purchase) return { purchase, created: false };
    }
    if (error) throw error;
    return { purchase: rowToPurchase(data), created: true };
  }

  async markFulfilled(id: string): Promise<{ purchase: Purchase; transitioned: boolean } | null> {
    const existing = await this.client().from("purchases").select("*").eq("id", id).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return null;
    if (existing.data.status === "fulfilled") {
      return { purchase: rowToPurchase(existing.data), transitioned: false };
    }

    const { data, error } = await this.client()
      .from("purchases")
      .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return { purchase: rowToPurchase(data), transitioned: true };
  }

  async listAll(opts: {
    limit: number;
    offset: number;
  }): Promise<{ purchases: Purchase[]; total: number }> {
    const { data, error, count } = await this.client()
      .from("purchases")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1);
    if (error) throw error;
    return { purchases: (data ?? []).map(rowToPurchase), total: count ?? 0 };
  }
}

class InMemoryPurchaseStore implements PurchaseStore {
  private purchases = new Map<string, Purchase>();

  async findById(id: string): Promise<Purchase | null> {
    return this.purchases.get(id) ?? null;
  }

  async findBySessionId(sessionId: string): Promise<Purchase | null> {
    for (const purchase of this.purchases.values()) {
      if (purchase.stripeSessionId === sessionId) return purchase;
    }
    return null;
  }

  async recordIfNotExists(
    input: RecordPurchaseInput,
  ): Promise<{ purchase: Purchase; created: boolean }> {
    const existing = await this.findBySessionId(input.stripeSessionId);
    if (existing) return { purchase: existing, created: false };

    const now = new Date().toISOString();
    const purchase: Purchase = {
      id: crypto.randomUUID(),
      subscriberId: input.subscriberId,
      email: input.email,
      stripeSessionId: input.stripeSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId,
      amountCents: input.amountCents,
      currency: input.currency,
      status: input.status,
      fulfilledAt: input.status === "fulfilled" ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    this.purchases.set(purchase.id, purchase);
    return { purchase, created: true };
  }

  async markFulfilled(id: string): Promise<{ purchase: Purchase; transitioned: boolean } | null> {
    const purchase = this.purchases.get(id);
    if (!purchase) return null;
    if (purchase.status === "fulfilled") return { purchase, transitioned: false };

    purchase.status = "fulfilled";
    purchase.fulfilledAt = new Date().toISOString();
    purchase.updatedAt = purchase.fulfilledAt;
    return { purchase, transitioned: true };
  }

  async listAll(opts: {
    limit: number;
    offset: number;
  }): Promise<{ purchases: Purchase[]; total: number }> {
    const all = [...this.purchases.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { purchases: all.slice(opts.offset, opts.offset + opts.limit), total: all.length };
  }
}

let store: PurchaseStore | null = null;

export function getPurchaseStore(): PurchaseStore {
  if (!store) {
    if (!isSupabaseConfigured()) {
      if (isRunningInProduction()) {
        throw new Error(
          "Supabase is not configured in production. Refusing to process Stripe " +
            "purchases against an in-memory store. See SETUP.md.",
        );
      }
      store = new InMemoryPurchaseStore();
    } else {
      store = new SupabasePurchaseStore();
    }
  }
  return store;
}
