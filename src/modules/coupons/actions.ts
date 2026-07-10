"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { getCreatorMembershipForUser, canManageStorefront } from "@/modules/creators/service";

const createCouponSchema = z.object({
  code: z.string().min(3).max(30),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.coerce.number().int().positive(),
  maxRedemptions: z.coerce.number().int().positive().optional(),
});

export async function createCouponAction(formData: FormData) {
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership || !canManageStorefront(membership.role)) throw new Error("You don't have permission to manage discount codes.");

  const parsed = createCouponSchema.parse({
    code: formData.get("code"),
    discountType: formData.get("discountType"),
    discountValue: formData.get("discountValue"),
    maxRedemptions: formData.get("maxRedemptions") || undefined,
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("coupons").insert({
    creator_id: membership.creator.id,
    code: parsed.code.toUpperCase(),
    discount_type: parsed.discountType,
    discount_value: parsed.discountValue,
    max_redemptions: parsed.maxRedemptions ?? null,
    created_by: user.id,
  });

  if (error) {
    if (error.code === "23505") throw new Error("You already have a coupon with that code.");
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/marketing");
}

export async function toggleCouponAction(formData: FormData) {
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership || !canManageStorefront(membership.role)) throw new Error("You don't have permission to manage discount codes.");

  const couponId = z.string().uuid().parse(formData.get("couponId"));
  const isActive = formData.get("isActive") === "true";

  const supabase = await createSupabaseServerClient();
  await supabase.from("coupons").update({ is_active: !isActive }).eq("id", couponId).eq("creator_id", membership.creator.id);
  revalidatePath("/dashboard/marketing");
}
