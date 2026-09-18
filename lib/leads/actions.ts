"use server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getSpamCheck } from "@/lib/leads/spam-prevention";
import { leadSchema } from "@/lib/validation/lead";
import type { Json } from "@/lib/supabase/types";

export type SubmitLeadResult = { ok: true } | { ok: false; error: string };

/**
 * Persists a public lead-capture submission. Uses the service-role client
 * because these come from anonymous visitors — the `leads_insert_public`
 * RLS policy (supabase/migrations/20260717000000_leads.sql) already allows
 * anon inserts directly, but routing through this Server Action keeps
 * server-side re-validation, spam-checking, and consistent
 * source/UTM-attribution handling in one place rather than trusting the
 * client to assemble a correct row.
 */
export async function submitLeadAction(input: unknown): Promise<SubmitLeadResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  if (getSpamCheck().isSpam({ honeypotValue: data.companyWebsite })) {
    // Deliberately report success to the caller — never tell a bot which
    // check it tripped.
    return { ok: true };
  }

  let service;
  try {
    service = createSupabaseServiceRoleClient();
  } catch {
    return {
      ok: false,
      error:
        "This form isn't connected yet in this environment (no Supabase service-role key configured). See docs/DEPLOYMENT.md.",
    };
  }

  const metadata: Record<string, string> = {};
  if (data.interest) metadata.interest = data.interest;

  const { error } = await service.from("leads").insert({
    lead_type: data.leadType,
    full_name: data.fullName,
    email: data.email,
    message: data.message || null,
    consent_given: data.consentGiven,
    source: data.source ?? null,
    utm_source: data.utmSource ?? null,
    utm_medium: data.utmMedium ?? null,
    utm_campaign: data.utmCampaign ?? null,
    metadata: metadata as Json,
  });

  if (error) {
    console.error("[leads] insert failed", error.message);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  return { ok: true };
}
