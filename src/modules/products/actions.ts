"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { getCreatorMembershipForUser, canManageProducts } from "@/modules/creators/service";
import { writeAuditLog } from "@/modules/audit/log";
import { slugify } from "@/lib/utils";
import { buildProductFileStoragePath } from "@/modules/files/service";
import { SupabaseStorageProvider } from "@/modules/storage/supabase-storage";

async function requireProductManager() {
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership || !canManageProducts(membership.role)) {
    throw new Error("You need to create a storefront before adding products.");
  }
  return { user, membership };
}

const createProductSchema = z.object({
  title: z.string().min(3).max(140),
  productType: z.string().min(1),
  categoryId: z.string().uuid().optional(),
});

export async function createProductAction(formData: FormData) {
  const { membership } = await requireProductManager();
  const parsed = createProductSchema.parse({
    title: formData.get("title"),
    productType: formData.get("productType"),
    categoryId: formData.get("categoryId") || undefined,
  });

  const supabase = await createSupabaseServerClient();
  const slug = `${slugify(parsed.title)}-${Math.random().toString(36).slice(2, 7)}`;

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      creator_id: membership.creator.id,
      slug,
      title: parsed.title,
      product_type: parsed.productType,
      category_id: parsed.categoryId ?? null,
      status: "draft",
      created_by: membership.creator.owner_id,
    })
    .select("id")
    .single();

  if (error || !product) throw new Error(error?.message ?? "Could not create product.");

  await writeAuditLog({ actorId: membership.creator.owner_id, action: "product.created", entityType: "product", entityId: product.id });

  redirect(`/dashboard/products/${product.id}`);
}

const updateProductSchema = z.object({
  productId: z.string().uuid(),
  title: z.string().min(3).max(140),
  shortDescription: z.string().max(200).optional(),
  fullDescription: z.string().optional(),
  pricingModel: z.enum(["fixed", "pay_what_you_want", "free"]),
  basePriceMinor: z.coerce.number().int().min(0),
  pwywMinimumMinor: z.coerce.number().int().min(0),
  currencyCode: z.string().length(3),
  refundPolicy: z.string().optional(),
  supportTerms: z.string().optional(),
  categoryId: z.string().uuid().optional(),
});

export async function updateProductAction(formData: FormData) {
  await requireProductManager();
  const parsed = updateProductSchema.parse({
    productId: formData.get("productId"),
    title: formData.get("title"),
    shortDescription: formData.get("shortDescription") || undefined,
    fullDescription: formData.get("fullDescription") || undefined,
    pricingModel: formData.get("pricingModel"),
    basePriceMinor: formData.get("basePriceMinor") || 0,
    pwywMinimumMinor: formData.get("pwywMinimumMinor") || 0,
    currencyCode: formData.get("currencyCode"),
    refundPolicy: formData.get("refundPolicy") || undefined,
    supportTerms: formData.get("supportTerms") || undefined,
    categoryId: formData.get("categoryId") || undefined,
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("products")
    .update({
      title: parsed.title,
      short_description: parsed.shortDescription ?? null,
      full_description: parsed.fullDescription ?? null,
      pricing_model: parsed.pricingModel,
      base_price_minor: parsed.pricingModel === "free" ? 0 : parsed.basePriceMinor,
      pwyw_minimum_minor: parsed.pricingModel === "pay_what_you_want" ? parsed.pwywMinimumMinor : 0,
      currency_code: parsed.currencyCode,
      refund_policy: parsed.refundPolicy ?? null,
      support_terms: parsed.supportTerms ?? null,
      category_id: parsed.categoryId ?? null,
    })
    .eq("id", parsed.productId);

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/products/${parsed.productId}`);
}

export async function submitProductForReviewAction(formData: FormData) {
  const { user } = await requireProductManager();
  const productId = z.string().uuid().parse(formData.get("productId"));
  const supabase = await createSupabaseServerClient();

  const { data: product } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
  if (!product) throw new Error("Product not found.");
  if (!product.title || product.base_price_minor === undefined) throw new Error("Complete product details before submitting.");

  await supabase.from("products").update({ status: "in_review", is_marketplace_submitted: true }).eq("id", productId);
  await supabase.from("product_submissions").insert({ product_id: productId, submitted_by: user.id });
  await writeAuditLog({ actorId: user.id, action: "product.submitted", entityType: "product", entityId: productId });

  revalidatePath(`/dashboard/products/${productId}`);
}

const requestUploadSchema = z.object({
  productId: z.string().uuid(),
  fileName: z.string().min(1),
  kind: z.enum(["file", "media"]),
});

export async function requestProductUploadUrlAction(input: { productId: string; fileName: string; kind: "file" | "media" }) {
  const { membership } = await requireProductManager();
  const parsed = requestUploadSchema.parse(input);

  const supabase = await createSupabaseServerClient();
  const { data: product } = await supabase.from("products").select("creator_id").eq("id", parsed.productId).maybeSingle();
  if (!product || product.creator_id !== membership.creator.id) throw new Error("Product not found.");

  const fileId = crypto.randomUUID();
  const bucket = parsed.kind === "file" ? "product-files" : "product-media";
  const path = buildProductFileStoragePath(membership.creator.id, parsed.productId, fileId, parsed.fileName);

  const storage = new SupabaseStorageProvider();
  const { signedUrl, token } = await storage.createSignedUploadUrl(bucket, path);

  return { signedUrl, token, path, bucket, fileId };
}

const attachFileSchema = z.object({
  productId: z.string().uuid(),
  storagePath: z.string().min(1),
  fileName: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  contentType: z.string().optional(),
});

export async function attachProductFileAction(input: z.infer<typeof attachFileSchema>) {
  await requireProductManager();
  const parsed = attachFileSchema.parse(input);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("product_files").insert({
    product_id: parsed.productId,
    file_name: parsed.fileName,
    storage_path: parsed.storagePath,
    size_bytes: parsed.sizeBytes,
    content_type: parsed.contentType,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/products/${parsed.productId}`);
}

const attachMediaSchema = z.object({
  productId: z.string().uuid(),
  storagePath: z.string().min(1),
  publicUrl: z.string().url(),
  mediaType: z.enum(["cover", "gallery"]),
});

export async function attachProductMediaAction(input: z.infer<typeof attachMediaSchema>) {
  await requireProductManager();
  const parsed = attachMediaSchema.parse(input);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("product_media").insert({
    product_id: parsed.productId,
    media_type: parsed.mediaType,
    storage_path: parsed.storagePath,
    external_url: parsed.publicUrl,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/products/${parsed.productId}`);
}
