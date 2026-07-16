"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/log";
import {
  createProduct,
  createProductVariants,
  getGarmentTemplate,
  linkProductToDesign,
  listProducts,
} from "@/lib/catalog/data-access";
import { requireCatalogEditAccess } from "@/lib/catalog/guard";
import { generateVariantMatrix } from "@/lib/catalog/variant-matrix";
import { getDesignProject, listMockups, updateDesignProjectStatus } from "@/lib/design-studio/data-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ConvertResult =
  | { ok: true; productId: string; alreadyConverted: boolean }
  | { ok: false; error: string };

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product"
  );
}

/**
 * Converts an approved design project into a product draft. Idempotent:
 * if this design has already been linked to a product (product_design_links
 * has a unique(product_id, design_project_id) constraint, but the check
 * here is "does *any* product already link this design"), the existing
 * product is returned rather than creating a duplicate — safe to click
 * twice, or to retry after a network failure.
 */
export async function convertDesignToProductAction(designProjectId: string): Promise<ConvertResult> {
  const { profile, membership } = await requireCatalogEditAccess();

  const design = await getDesignProject(membership.tenantId, designProjectId);
  if (!design) return { ok: false, error: "Design project not found." };

  const supabase = await createSupabaseServerClient();
  const { data: existingLink } = await supabase
    .from("product_design_links")
    .select("product_id")
    .eq("tenant_id", membership.tenantId)
    .eq("design_project_id", designProjectId)
    .maybeSingle();
  if (existingLink) {
    return { ok: true, productId: existingLink.product_id, alreadyConverted: true };
  }

  if (design.status !== "approved") {
    return { ok: false, error: "Only an approved design can be converted to a product." };
  }

  const existingProducts = await listProducts(membership.tenantId);
  const baseSlug = slugify(design.name);
  let slug = baseSlug;
  let suffix = 1;
  while (existingProducts.some((p) => p.slug === slug)) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const productId = await createProduct(membership.tenantId, {
    name: design.name,
    slug,
    garmentTemplateId: design.garmentTemplateId,
    designProjectId: design.id,
    productionMethod: design.productionMethod,
  });

  await linkProductToDesign(membership.tenantId, productId, designProjectId);

  if (design.garmentTemplateId) {
    const template = await getGarmentTemplate(membership.tenantId, design.garmentTemplateId);
    if (template) {
      const combinations = generateVariantMatrix({
        sizes: template.sizes.map((s) => s.sizeLabel),
        colors: template.colors.map((c) => c.name),
      });
      const skuPrefix = slug.slice(0, 6).toUpperCase();
      await createProductVariants(
        membership.tenantId,
        productId,
        combinations.map((c, index) => ({ ...c, sku: `${skuPrefix}-${(index + 1).toString().padStart(3, "0")}` })),
      );
    }
  }

  const mockups = await listMockups(membership.tenantId);
  const linkedMockup = mockups.find((m) => m.designProjectId === designProjectId);
  if (linkedMockup?.views[0]) {
    await supabase
      .from("products")
      .update({ primary_image_path: linkedMockup.views[0].imagePath })
      .eq("tenant_id", membership.tenantId)
      .eq("id", productId);
  }

  await updateDesignProjectStatus(membership.tenantId, designProjectId, "converted_to_product");

  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "product.created",
    targetTable: "products",
    targetId: productId,
    metadata: { convertedFromDesignProjectId: designProjectId },
  });

  revalidatePath("/app/products");
  revalidatePath(`/app/design-studio/${designProjectId}`);

  return { ok: true, productId, alreadyConverted: false };
}
