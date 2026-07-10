"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/session";
import { writeAuditLog } from "@/modules/audit/log";

export async function approveProductAction(formData: FormData) {
  const admin = await requireAdmin();
  const productId = z.string().uuid().parse(formData.get("productId"));
  const supabase = await createSupabaseServerClient();

  const { data: product } = await supabase.from("products").select("status").eq("id", productId).maybeSingle();
  if (!product) throw new Error("Product not found.");

  const { error } = await supabase
    .from("products")
    .update({ status: "published", published_at: new Date().toISOString(), rejected_reason: null })
    .eq("id", productId);
  if (error) throw new Error(error.message);

  await supabase
    .from("product_submissions")
    .update({ status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("product_id", productId)
    .eq("status", "pending");

  await writeAuditLog({
    actorId: admin.id,
    actorRole: "platform_admin",
    action: "product.approved",
    entityType: "product",
    entityId: productId,
    beforeState: { status: product.status },
    afterState: { status: "published" },
  });

  revalidatePath("/admin/moderation");
}

const rejectSchema = z.object({ productId: z.string().uuid(), reason: z.string().min(3).max(500) });

export async function rejectProductAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = rejectSchema.parse({ productId: formData.get("productId"), reason: formData.get("reason") });
  const supabase = await createSupabaseServerClient();

  const { data: product } = await supabase.from("products").select("status").eq("id", parsed.productId).maybeSingle();
  if (!product) throw new Error("Product not found.");

  const { error } = await supabase
    .from("products")
    .update({ status: "rejected", rejected_reason: parsed.reason })
    .eq("id", parsed.productId);
  if (error) throw new Error(error.message);

  await supabase
    .from("product_submissions")
    .update({ status: "rejected", notes: parsed.reason, reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("product_id", parsed.productId)
    .eq("status", "pending");

  await writeAuditLog({
    actorId: admin.id,
    actorRole: "platform_admin",
    action: "product.rejected",
    entityType: "product",
    entityId: parsed.productId,
    beforeState: { status: product.status },
    afterState: { status: "rejected", reason: parsed.reason },
  });

  revalidatePath("/admin/moderation");
}

const verificationSchema = z.object({ creatorId: z.string().uuid(), reason: z.string().max(500).optional() });

export async function approveSellerVerificationAction(formData: FormData) {
  const admin = await requireAdmin();
  const { creatorId } = verificationSchema.parse({ creatorId: formData.get("creatorId") });
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("seller_verifications")
    .update({ status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("creator_id", creatorId);
  if (error) throw new Error(error.message);

  await writeAuditLog({ actorId: admin.id, actorRole: "platform_admin", action: "creator.verified", entityType: "creator_account", entityId: creatorId });
  revalidatePath("/admin/creators");
}

export async function rejectSellerVerificationAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = verificationSchema.parse({ creatorId: formData.get("creatorId"), reason: formData.get("reason") });
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("seller_verifications")
    .update({ status: "rejected", rejection_reason: parsed.reason ?? null, reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("creator_id", parsed.creatorId);
  if (error) throw new Error(error.message);

  await writeAuditLog({ actorId: admin.id, actorRole: "platform_admin", action: "creator.verification_rejected", entityType: "creator_account", entityId: parsed.creatorId });
  revalidatePath("/admin/creators");
}
