"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/log";
import {
  createProduct,
  createProductVariants,
  getProduct,
  getVariantCostComponents,
  listProductVariants,
  saveVariantCostComponents,
  updateProduct,
  updateProductStatus,
  updateVariantPricing,
  type ProductInput,
  type ProductRow,
  type VariantPricingInput,
} from "@/lib/catalog/data-access";
import { requireCatalogEditAccess } from "@/lib/catalog/guard";
import type { CostComponentKey } from "@/lib/catalog/pricing-engine";
import { checkProductActivation } from "@/lib/catalog/product-activation";
import { findDuplicateCombinations, generateVariantMatrix, type VariantDimensions } from "@/lib/catalog/variant-matrix";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createProductAction(
  input: Pick<ProductInput, "name" | "category" | "garmentTemplateId" | "designProjectId" | "productionMethod">,
): Promise<ActionResult<{ productId: string }>> {
  const { profile, membership } = await requireCatalogEditAccess();
  const slug = slugify(input.name);
  const productId = await createProduct(membership.tenantId, { ...input, slug });

  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "product.created",
    targetTable: "products",
    targetId: productId,
  });
  revalidatePath("/app/products");
  return { ok: true, data: { productId } };
}

export async function updateProductAction(productId: string, input: Partial<ProductInput>): Promise<ActionResult> {
  const { profile, membership } = await requireCatalogEditAccess();
  await updateProduct(membership.tenantId, productId, input);
  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "product.updated",
    targetTable: "products",
    targetId: productId,
  });
  revalidatePath(`/app/products/${productId}`);
  return { ok: true, data: undefined };
}

export async function updateProductStatusAction(
  productId: string,
  toStatus: ProductRow["status"],
): Promise<ActionResult> {
  const { profile, membership } = await requireCatalogEditAccess();
  const product = await getProduct(membership.tenantId, productId);
  if (!product) return { ok: false, error: "Product not found." };

  if (toStatus === "active") {
    const variants = await listProductVariants(membership.tenantId, productId);
    const check = checkProductActivation({
      name: product.name,
      productionMethod: product.productionMethod,
      variants: variants.map((v) => ({ retailPriceCents: v.retailPriceCents })),
    });
    if (!check.canActivate) {
      return { ok: false, error: check.missingRequirements.join(" ") };
    }
  }

  await updateProductStatus(membership.tenantId, productId, toStatus, profile.id);
  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: toStatus === "active" ? "product.activated" : toStatus === "archived" ? "product.archived" : "product.updated",
    targetTable: "products",
    targetId: productId,
    metadata: { toStatus },
  });
  revalidatePath(`/app/products/${productId}`);
  revalidatePath("/app/products");
  return { ok: true, data: undefined };
}

export async function generateVariantsAction(
  productId: string,
  dimensions: VariantDimensions,
  skuPrefix: string,
): Promise<ActionResult<{ createdCount: number }>> {
  const { profile, membership } = await requireCatalogEditAccess();

  const candidates = generateVariantMatrix(dimensions);
  const duplicatesWithinCandidates = findDuplicateCombinations(candidates);
  if (duplicatesWithinCandidates.length > 0) {
    return { ok: false, error: "The selected dimensions produce duplicate combinations." };
  }

  const existing = await listProductVariants(membership.tenantId, productId);
  const existingKeys = new Set(
    existing.map((v) => [v.sizeLabel, v.colorName, v.garmentStyle, v.material, v.printLocation].map((x) => x ?? "").join("|")),
  );

  const toCreate = candidates
    .filter((c) => !existingKeys.has([c.sizeLabel, c.colorName, c.garmentStyle, c.material, c.printLocation].map((x) => x ?? "").join("|")))
    .map((c, index) => ({
      ...c,
      sku: `${skuPrefix}-${(existing.length + index + 1).toString().padStart(3, "0")}`,
    }));

  if (toCreate.length === 0) {
    return { ok: true, data: { createdCount: 0 } };
  }

  await createProductVariants(membership.tenantId, productId, toCreate);
  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "product.variants_generated",
    targetTable: "product_variants",
    targetId: productId,
    metadata: { createdCount: toCreate.length },
  });
  revalidatePath(`/app/products/${productId}/variants`);
  return { ok: true, data: { createdCount: toCreate.length } };
}

export async function saveVariantCostComponentsAction(
  variantId: string,
  components: Partial<Record<CostComponentKey, number>>,
): Promise<ActionResult> {
  const { membership } = await requireCatalogEditAccess();
  await saveVariantCostComponents(membership.tenantId, variantId, components);
  return { ok: true, data: undefined };
}

export async function getVariantCostComponentsAction(
  variantId: string,
): Promise<Partial<Record<CostComponentKey, number>>> {
  const { membership } = await requireCatalogEditAccess();
  return getVariantCostComponents(membership.tenantId, variantId);
}

export async function updateVariantPricingAction(
  productId: string,
  variantId: string,
  input: VariantPricingInput,
  reason?: string,
): Promise<ActionResult> {
  const { profile, membership } = await requireCatalogEditAccess();
  await updateVariantPricing(membership.tenantId, variantId, input, profile.id, reason);
  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "product.pricing_changed",
    targetTable: "product_variants",
    targetId: variantId,
  });
  revalidatePath(`/app/products/${productId}/pricing`);
  return { ok: true, data: undefined };
}
