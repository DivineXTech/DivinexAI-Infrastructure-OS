"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { getCreatorMembershipForUser, canManageStorefront } from "@/modules/creators/service";
import { writeAuditLog } from "@/modules/audit/log";

const updateSchema = z.object({
  storeName: z.string().min(2).max(80),
  tagline: z.string().max(140).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(80).optional(),
  isPublished: z.boolean(),
});

export async function updateStorefrontAction(formData: FormData) {
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership || !canManageStorefront(membership.role)) throw new Error("You don't have permission to edit this storefront.");

  const parsed = updateSchema.parse({
    storeName: formData.get("storeName"),
    tagline: formData.get("tagline") || undefined,
    description: formData.get("description") || undefined,
    category: formData.get("category") || undefined,
    isPublished: formData.get("isPublished") === "on",
  });

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase.from("storefronts").select("is_published").eq("creator_id", membership.creator.id).maybeSingle();

  const { error } = await supabase
    .from("storefronts")
    .update({
      store_name: parsed.storeName,
      tagline: parsed.tagline ?? null,
      description: parsed.description ?? null,
      category: parsed.category ?? null,
      is_published: parsed.isPublished,
      published_at: parsed.isPublished && !existing?.is_published ? new Date().toISOString() : undefined,
    })
    .eq("creator_id", membership.creator.id);

  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorId: user.id,
    action: parsed.isPublished ? "storefront.published" : "storefront.updated",
    entityType: "storefront",
    entityId: membership.creator.id,
  });

  revalidatePath("/dashboard/storefront");
}
