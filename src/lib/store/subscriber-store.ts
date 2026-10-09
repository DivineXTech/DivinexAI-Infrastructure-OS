import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { generateReferralCode } from "@/lib/referral";
import { isRunningInProduction, isSupabaseConfigured } from "@/lib/env";
import type { Subscriber, SubscriberStatus, UpsertSubscriberInput } from "@/lib/store/types";

/**
 * Subscriber persistence, abstracted behind a single interface.
 *
 * - In production (Supabase configured): reads/writes go to Postgres via
 *   the service-role client, protected by RLS.
 * - In local development without Supabase credentials: falls back to an
 *   in-memory store so the full signup → email → Chapter 12 flow can be
 *   exercised on `npm run dev` with zero external setup. Data does not
 *   persist across server restarts in this mode — a startup warning makes
 *   that explicit.
 */
export interface SubscriberStore {
  findByEmail(email: string): Promise<Subscriber | null>;
  findById(id: string): Promise<Subscriber | null>;
  findByReferralCode(code: string): Promise<Subscriber | null>;
  upsertByEmail(
    input: UpsertSubscriberInput,
  ): Promise<{ subscriber: Subscriber; isNew: boolean }>;
  countReferrals(referralCode: string): Promise<number>;
  markChapter12Accessed(id: string): Promise<void>;
  markUnsubscribedByEmail(email: string): Promise<boolean>;
  getStatusByEmail(email: string): Promise<SubscriberStatus | null>;
}

type SubscriberRow = Database["public"]["Tables"]["subscribers"]["Row"];

function rowToSubscriber(row: SubscriberRow): Subscriber {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    country: row.country,
    marketingConsent: row.marketing_consent,
    termsAccepted: row.terms_accepted,
    acceptedEarlyAccessTermsAt: row.accepted_early_access_terms_at,
    referralCode: row.referral_code,
    referredBy: row.referred_by,
    socialFollowConfirmed: row.social_follow_confirmed,
    socialLikeConfirmed: row.social_like_confirmed,
    socialShareConfirmed: row.social_share_confirmed,
    chapter12AccessedAt: row.chapter12_accessed_at,
    unsubscribed: row.unsubscribed,
    unsubscribedAt: row.unsubscribed_at,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class SupabaseSubscriberStore implements SubscriberStore {
  private client() {
    const client = getSupabaseAdmin();
    if (!client) throw new Error("Supabase admin client is not configured.");
    return client;
  }

  async findByEmail(email: string): Promise<Subscriber | null> {
    const { data, error } = await this.client()
      .from("subscribers")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToSubscriber(data) : null;
  }

  async findById(id: string): Promise<Subscriber | null> {
    const { data, error } = await this.client()
      .from("subscribers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToSubscriber(data) : null;
  }

  async findByReferralCode(code: string): Promise<Subscriber | null> {
    const { data, error } = await this.client()
      .from("subscribers")
      .select("*")
      .eq("referral_code", code)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToSubscriber(data) : null;
  }

  async upsertByEmail(
    input: UpsertSubscriberInput,
  ): Promise<{ subscriber: Subscriber; isNew: boolean }> {
    const existing = await this.findByEmail(input.email);

    if (existing) {
      const { data, error } = await this.client()
        .from("subscribers")
        .update({
          first_name: input.firstName,
          last_name: input.lastName,
          phone: input.phone ?? existing.phone,
          country: input.country ?? existing.country,
          marketing_consent: input.marketingConsent,
          terms_accepted: input.termsAccepted,
          social_follow_confirmed: input.socialFollowConfirmed || existing.socialFollowConfirmed,
          social_like_confirmed: input.socialLikeConfirmed || existing.socialLikeConfirmed,
          social_share_confirmed: input.socialShareConfirmed || existing.socialShareConfirmed,
          unsubscribed: false,
          unsubscribed_at: null,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return { subscriber: rowToSubscriber(data), isNew: false };
    }

    // Retry on the (rare) referral code collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const referralCode = generateReferralCode();
      const { data, error } = await this.client()
        .from("subscribers")
        .insert({
          first_name: input.firstName,
          last_name: input.lastName,
          email: input.email,
          phone: input.phone,
          country: input.country,
          marketing_consent: input.marketingConsent,
          terms_accepted: input.termsAccepted,
          accepted_early_access_terms_at: new Date().toISOString(),
          referral_code: referralCode,
          referred_by: input.referredBy,
          social_follow_confirmed: input.socialFollowConfirmed,
          social_like_confirmed: input.socialLikeConfirmed,
          social_share_confirmed: input.socialShareConfirmed,
          source: input.source,
        })
        .select("*")
        .single();

      if (!error) return { subscriber: rowToSubscriber(data), isNew: true };
      // 23505 = unique_violation. Retry only for referral_code collisions.
      if (error.code === "23505" && error.message.includes("referral_code")) continue;
      throw error;
    }
    throw new Error("Failed to allocate a unique referral code after 5 attempts.");
  }

  async countReferrals(referralCode: string): Promise<number> {
    const { count, error } = await this.client()
      .from("subscribers")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", referralCode);
    if (error) throw error;
    return count ?? 0;
  }

  async markChapter12Accessed(id: string): Promise<void> {
    const { error } = await this.client()
      .from("subscribers")
      .update({ chapter12_accessed_at: new Date().toISOString() })
      .eq("id", id)
      .is("chapter12_accessed_at", null);
    if (error) throw error;
  }

  async markUnsubscribedByEmail(email: string): Promise<boolean> {
    const { data, error } = await this.client()
      .from("subscribers")
      .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
      .eq("email", email)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async getStatusByEmail(email: string): Promise<SubscriberStatus | null> {
    const subscriber = await this.findByEmail(email);
    if (!subscriber) return null;
    const referralCount = await this.countReferrals(subscriber.referralCode);
    return { subscriber, referralCount };
  }
}

class InMemorySubscriberStore implements SubscriberStore {
  private byId = new Map<string, Subscriber>();
  private warned = false;

  private warnOnce() {
    if (this.warned) return;
    this.warned = true;
    console.warn(
      "[subscriber-store] Supabase is not configured — using an in-memory store. " +
        "Data will not persist across restarts and is not shared across serverless " +
        "instances. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for " +
        "real persistence. See SETUP.md.",
    );
  }

  async findByEmail(email: string): Promise<Subscriber | null> {
    this.warnOnce();
    for (const subscriber of this.byId.values()) {
      if (subscriber.email === email) return subscriber;
    }
    return null;
  }

  async findById(id: string): Promise<Subscriber | null> {
    this.warnOnce();
    return this.byId.get(id) ?? null;
  }

  async findByReferralCode(code: string): Promise<Subscriber | null> {
    this.warnOnce();
    for (const subscriber of this.byId.values()) {
      if (subscriber.referralCode === code) return subscriber;
    }
    return null;
  }

  async upsertByEmail(
    input: UpsertSubscriberInput,
  ): Promise<{ subscriber: Subscriber; isNew: boolean }> {
    this.warnOnce();
    const existing = await this.findByEmail(input.email);
    const now = new Date().toISOString();

    if (existing) {
      const updated: Subscriber = {
        ...existing,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? existing.phone,
        country: input.country ?? existing.country,
        marketingConsent: input.marketingConsent,
        termsAccepted: input.termsAccepted,
        socialFollowConfirmed: input.socialFollowConfirmed || existing.socialFollowConfirmed,
        socialLikeConfirmed: input.socialLikeConfirmed || existing.socialLikeConfirmed,
        socialShareConfirmed: input.socialShareConfirmed || existing.socialShareConfirmed,
        unsubscribed: false,
        unsubscribedAt: null,
        updatedAt: now,
      };
      this.byId.set(updated.id, updated);
      return { subscriber: updated, isNew: false };
    }

    let referralCode = generateReferralCode();
    while (await this.findByReferralCode(referralCode)) {
      referralCode = generateReferralCode();
    }

    const subscriber: Subscriber = {
      id: crypto.randomUUID(),
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      country: input.country,
      marketingConsent: input.marketingConsent,
      termsAccepted: input.termsAccepted,
      acceptedEarlyAccessTermsAt: now,
      referralCode,
      referredBy: input.referredBy,
      socialFollowConfirmed: input.socialFollowConfirmed,
      socialLikeConfirmed: input.socialLikeConfirmed,
      socialShareConfirmed: input.socialShareConfirmed,
      chapter12AccessedAt: null,
      unsubscribed: false,
      unsubscribedAt: null,
      source: input.source,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(subscriber.id, subscriber);
    return { subscriber, isNew: true };
  }

  async countReferrals(referralCode: string): Promise<number> {
    this.warnOnce();
    let count = 0;
    for (const subscriber of this.byId.values()) {
      if (subscriber.referredBy === referralCode) count += 1;
    }
    return count;
  }

  async markChapter12Accessed(id: string): Promise<void> {
    const subscriber = this.byId.get(id);
    if (subscriber && !subscriber.chapter12AccessedAt) {
      subscriber.chapter12AccessedAt = new Date().toISOString();
    }
  }

  async markUnsubscribedByEmail(email: string): Promise<boolean> {
    const subscriber = await this.findByEmail(email);
    if (!subscriber) return false;
    subscriber.unsubscribed = true;
    subscriber.unsubscribedAt = new Date().toISOString();
    return true;
  }

  async getStatusByEmail(email: string): Promise<SubscriberStatus | null> {
    const subscriber = await this.findByEmail(email);
    if (!subscriber) return null;
    const referralCount = await this.countReferrals(subscriber.referralCode);
    return { subscriber, referralCount };
  }
}

let store: SubscriberStore | null = null;

export function getSubscriberStore(): SubscriberStore {
  if (!store) {
    if (!isSupabaseConfigured()) {
      if (isRunningInProduction()) {
        throw new Error(
          "Supabase is not configured in production (NEXT_PUBLIC_SUPABASE_URL / " +
            "SUPABASE_SERVICE_ROLE_KEY are missing). Refusing to fall back to the " +
            "in-memory store — subscriber data would be lost on every cold start. " +
            "Set these in the Vercel project's Production environment variables. " +
            "See SETUP.md.",
        );
      }
      store = new InMemorySubscriberStore();
    } else {
      store = new SupabaseSubscriberStore();
    }
  }
  return store;
}
