"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { writeAuditLog } from "@/modules/audit/log";
import { slugify } from "@/lib/utils";

const purposeSchema = z.object({ purpose: z.enum(["buy", "sell", "both"]) });

export async function setOnboardingPurpose(formData: FormData) {
  const user = await requireUser();
  const { purpose } = purposeSchema.parse({ purpose: formData.get("purpose") });

  const supabase = await createSupabaseServerClient();
  const nextStep = purpose === "buy" ? "profile" : "profile";
  await supabase
    .from("profiles")
    .update({ account_purpose: purpose, onboarding_step: nextStep })
    .eq("id", user.id);

  redirect("/onboarding/profile");
}

const profileSchema = z.object({
  displayName: z.string().min(2).max(80),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only."),
  countryCode: z.string().length(2),
  preferredCurrency: z.string().length(3),
});

export async function saveOnboardingProfile(formData: FormData) {
  const user = await requireUser();
  const parsed = profileSchema.parse({
    displayName: formData.get("displayName"),
    username: slugify(String(formData.get("username") ?? "")),
    countryCode: formData.get("countryCode"),
    preferredCurrency: formData.get("preferredCurrency"),
  });

  const supabase = await createSupabaseServerClient();
  const wantsToSell = user.profile?.account_purpose === "sell" || user.profile?.account_purpose === "both";
  const nextStep = wantsToSell ? "store" : "completed";

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.displayName,
      username: parsed.username,
      country_code: parsed.countryCode,
      preferred_currency_code: parsed.preferredCurrency,
      onboarding_step: nextStep,
      onboarding_completed_at: wantsToSell ? null : new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("That username is already taken.");
    }
    throw new Error(error.message);
  }

  redirect(wantsToSell ? "/onboarding/store" : "/onboarding/done");
}

const storeSchema = z.object({
  storeName: z.string().min(2).max(80),
  storeSlug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  category: z.string().max(80).optional(),
  supportEmail: z.string().email(),
});

export async function createOnboardingStore(formData: FormData) {
  const user = await requireUser();
  const parsed = storeSchema.parse({
    storeName: formData.get("storeName"),
    storeSlug: slugify(String(formData.get("storeSlug") ?? "")),
    description: formData.get("description") || undefined,
    category: formData.get("category") || undefined,
    supportEmail: formData.get("supportEmail"),
  });

  const supabase = await createSupabaseServerClient();

  const { data: creator, error: creatorError } = await supabase
    .from("creator_accounts")
    .insert({ owner_id: user.id, business_type: "individual", country_code: user.profile?.country_code ?? null, support_email: parsed.supportEmail })
    .select("*")
    .single();

  if (creatorError || !creator) {
    throw new Error(creatorError?.message ?? "Could not create your creator account.");
  }

  const { error: storefrontError } = await supabase.from("storefronts").insert({
    creator_id: creator.id,
    slug: parsed.storeSlug,
    store_name: parsed.storeName,
    description: parsed.description,
    category: parsed.category,
    is_published: false,
  });

  if (storefrontError) {
    if (storefrontError.code === "23505") {
      throw new Error("That store URL is already taken.");
    }
    throw new Error(storefrontError.message);
  }

  await supabase.from("profiles").update({ onboarding_step: "payment" }).eq("id", user.id);
  await writeAuditLog({ actorId: user.id, action: "creator.onboarded", entityType: "creator_account", entityId: creator.id });

  redirect("/onboarding/payment");
}

export async function completeOnboardingPayment() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("profiles")
    .update({ onboarding_step: "completed", onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);
  redirect("/onboarding/done");
}
