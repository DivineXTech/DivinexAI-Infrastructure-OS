import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { VariantCombination } from "@/lib/catalog/variant-matrix";
import type { CostComponentKey } from "@/lib/catalog/pricing-engine";
import type { GarmentView } from "@/lib/design-studio/project-schema";
import type { Database } from "@/lib/supabase/types";

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type ProductVariantUpdate = Database["public"]["Tables"]["product_variants"]["Update"];

/**
 * Every function takes an explicit `tenantId` resolved server-side by the
 * caller (lib/catalog/guard.ts) from the authenticated session — never
 * from client input — and filters by it explicitly wherever the table has
 * a tenant_id, in addition to whatever RLS also enforces. Garment
 * templates are the one exception: platform templates (tenant_id null)
 * are intentionally readable across tenants, so their query is `tenant_id
 * is null or tenant_id = :tenantId` rather than an equality filter alone —
 * see docs/GARMENT_TEMPLATES.md.
 */

// ---------------------------------------------------------------------------
// garment_templates
// ---------------------------------------------------------------------------
export type GarmentTemplateSummary = {
  id: string;
  tenantId: string | null;
  slug: string;
  name: string;
  category: string;
  status: "draft" | "active" | "archived";
  supportedProductionMethods: string[];
};

export async function listGarmentTemplates(tenantId: string): Promise<GarmentTemplateSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("garment_templates")
    .select("id, tenant_id, slug, name, category, status, supported_production_methods")
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .order("name");
  return (data ?? []).map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    status: row.status,
    supportedProductionMethods: row.supported_production_methods,
  }));
}

export type GarmentTemplateDetail = GarmentTemplateSummary & {
  manufacturer: string | null;
  description: string | null;
  fabricComposition: string | null;
  weight: string | null;
  fit: string | null;
  audience: string | null;
  baseWholesaleCostCents: number | null;
  views: { id: string; viewKey: GarmentView | "detail"; imagePath: string | null; svgMarkup: string | null }[];
  colors: { id: string; name: string; hexValue: string }[];
  sizes: { id: string; sizeLabel: string }[];
  printZones: {
    id: string;
    zoneKey: string;
    viewKey: GarmentView;
    x: number;
    y: number;
    width: number;
    height: number;
    safeWidth: number | null;
    safeHeight: number | null;
    supportedProductionMethods: string[];
  }[];
};

export async function getGarmentTemplate(
  tenantId: string,
  templateId: string,
): Promise<GarmentTemplateDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data: template } = await supabase
    .from("garment_templates")
    .select("*")
    .eq("id", templateId)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .maybeSingle();
  if (!template) return null;

  const [{ data: views }, { data: colors }, { data: sizes }, { data: printZones }] = await Promise.all([
    supabase
      .from("garment_template_views")
      .select("id, view_key, image_path, svg_markup")
      .eq("garment_template_id", templateId)
      .order("sort_order"),
    supabase
      .from("garment_template_colors")
      .select("id, name, hex_value")
      .eq("garment_template_id", templateId)
      .order("sort_order"),
    supabase
      .from("garment_template_sizes")
      .select("id, size_label")
      .eq("garment_template_id", templateId)
      .order("sort_order"),
    supabase
      .from("garment_print_zones")
      .select("id, zone_key, view_key, x, y, width, height, safe_width, safe_height, supported_production_methods")
      .eq("garment_template_id", templateId),
  ]);

  return {
    id: template.id,
    tenantId: template.tenant_id,
    slug: template.slug,
    name: template.name,
    category: template.category,
    status: template.status,
    supportedProductionMethods: template.supported_production_methods,
    manufacturer: template.manufacturer,
    description: template.description,
    fabricComposition: template.fabric_composition,
    weight: template.weight,
    fit: template.fit,
    audience: template.audience,
    baseWholesaleCostCents: template.base_wholesale_cost_cents,
    views: (views ?? []).map((v) => ({
      id: v.id,
      viewKey: v.view_key,
      imagePath: v.image_path,
      svgMarkup: v.svg_markup,
    })),
    colors: (colors ?? []).map((c) => ({ id: c.id, name: c.name, hexValue: c.hex_value })),
    sizes: (sizes ?? []).map((s) => ({ id: s.id, sizeLabel: s.size_label })),
    printZones: (printZones ?? []).map((z) => ({
      id: z.id,
      zoneKey: z.zone_key,
      viewKey: z.view_key,
      x: z.x,
      y: z.y,
      width: z.width,
      height: z.height,
      safeWidth: z.safe_width,
      safeHeight: z.safe_height,
      supportedProductionMethods: z.supported_production_methods,
    })),
  };
}

export type CreateTenantGarmentTemplateInput = {
  slug: string;
  name: string;
  category: string;
  description?: string;
  supportedProductionMethods: string[];
};

export async function createTenantGarmentTemplate(
  tenantId: string,
  createdBy: string,
  input: CreateTenantGarmentTemplateInput,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("garment_templates")
    .insert({
      tenant_id: tenantId,
      slug: input.slug,
      name: input.name,
      category: input.category,
      description: input.description ?? null,
      supported_production_methods: input.supportedProductionMethods,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create garment template: ${error?.message}`);
  return data.id;
}

// ---------------------------------------------------------------------------
// products
// ---------------------------------------------------------------------------
export type ProductRow = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  fullDescription: string | null;
  category: string | null;
  garmentTemplateId: string | null;
  designProjectId: string | null;
  productionMethod: string | null;
  status: "draft" | "ready_for_review" | "approved" | "active" | "paused" | "archived";
  salesChannels: string[];
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  tags: string[];
  primaryImagePath: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapProduct(row: {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  short_description: string | null;
  full_description: string | null;
  category: string | null;
  garment_template_id: string | null;
  design_project_id: string | null;
  production_method: string | null;
  status: ProductRow["status"];
  sales_channels: string[];
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  tags: string[];
  primary_image_path: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}): ProductRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    category: row.category,
    garmentTemplateId: row.garment_template_id,
    designProjectId: row.design_project_id,
    productionMethod: row.production_method,
    status: row.status,
    salesChannels: row.sales_channels,
    isFeatured: row.is_featured,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    tags: row.tags,
    primaryImagePath: row.primary_image_path,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PRODUCT_COLUMNS =
  "id, tenant_id, name, slug, short_description, full_description, category, garment_template_id, design_project_id, production_method, status, sales_channels, is_featured, seo_title, seo_description, tags, primary_image_path, internal_notes, created_at, updated_at";

export async function listProducts(tenantId: string): Promise<ProductRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  return (data ?? []).map(mapProduct);
}

export async function getProduct(tenantId: string, productId: string): Promise<ProductRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .maybeSingle();
  return data ? mapProduct(data) : null;
}

export type ProductInput = {
  name: string;
  slug: string;
  shortDescription?: string;
  fullDescription?: string;
  category?: string;
  garmentTemplateId?: string | null;
  designProjectId?: string | null;
  productionMethod?: string | null;
  salesChannels?: string[];
  isFeatured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  tags?: string[];
  internalNotes?: string;
};

export async function createProduct(tenantId: string, input: ProductInput): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      slug: input.slug,
      short_description: input.shortDescription ?? null,
      full_description: input.fullDescription ?? null,
      category: input.category ?? null,
      garment_template_id: input.garmentTemplateId ?? null,
      design_project_id: input.designProjectId ?? null,
      production_method: input.productionMethod ?? null,
      sales_channels: input.salesChannels ?? [],
      is_featured: input.isFeatured ?? false,
      seo_title: input.seoTitle ?? null,
      seo_description: input.seoDescription ?? null,
      tags: input.tags ?? [],
      internal_notes: input.internalNotes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create product: ${error?.message}`);
  return data.id;
}

export async function updateProduct(
  tenantId: string,
  productId: string,
  input: Partial<ProductInput>,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const patch: ProductUpdate = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.shortDescription !== undefined) patch.short_description = input.shortDescription;
  if (input.fullDescription !== undefined) patch.full_description = input.fullDescription;
  if (input.category !== undefined) patch.category = input.category;
  if (input.productionMethod !== undefined) patch.production_method = input.productionMethod;
  if (input.salesChannels !== undefined) patch.sales_channels = input.salesChannels;
  if (input.isFeatured !== undefined) patch.is_featured = input.isFeatured;
  if (input.seoTitle !== undefined) patch.seo_title = input.seoTitle;
  if (input.seoDescription !== undefined) patch.seo_description = input.seoDescription;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.internalNotes !== undefined) patch.internal_notes = input.internalNotes;

  const { error } = await supabase.from("products").update(patch).eq("tenant_id", tenantId).eq("id", productId);
  if (error) throw new Error(`Failed to update product: ${error.message}`);
}

export async function updateProductStatus(
  tenantId: string,
  productId: string,
  toStatus: ProductRow["status"],
  changedBy: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const current = await getProduct(tenantId, productId);
  if (!current) throw new Error("Product not found");

  const { error } = await supabase
    .from("products")
    .update({ status: toStatus, archived_at: toStatus === "archived" ? new Date().toISOString() : null })
    .eq("tenant_id", tenantId)
    .eq("id", productId);
  if (error) throw new Error(`Failed to update product status: ${error.message}`);

  await supabase.from("product_status_history").insert({
    tenant_id: tenantId,
    product_id: productId,
    from_status: current.status,
    to_status: toStatus,
    changed_by: changedBy,
  });
}

// ---------------------------------------------------------------------------
// product_variants + cost components + pricing history
// ---------------------------------------------------------------------------
export type ProductVariantRow = {
  id: string;
  productId: string;
  sku: string;
  sizeLabel: string | null;
  colorName: string | null;
  garmentStyle: string | null;
  material: string | null;
  printLocation: string | null;
  baseGarmentCostCents: number;
  printCostCents: number;
  packagingCostCents: number;
  additionalCostCents: number;
  retailPriceCents: number | null;
  wholesalePriceCents: number | null;
  compareAtPriceCents: number | null;
  isActive: boolean;
};

const VARIANT_COLUMNS =
  "id, product_id, sku, size_label, color_name, garment_style, material, print_location, base_garment_cost_cents, print_cost_cents, packaging_cost_cents, additional_cost_cents, retail_price_cents, wholesale_price_cents, compare_at_price_cents, is_active";

function mapVariant(row: {
  id: string;
  product_id: string;
  sku: string;
  size_label: string | null;
  color_name: string | null;
  garment_style: string | null;
  material: string | null;
  print_location: string | null;
  base_garment_cost_cents: number;
  print_cost_cents: number;
  packaging_cost_cents: number;
  additional_cost_cents: number;
  retail_price_cents: number | null;
  wholesale_price_cents: number | null;
  compare_at_price_cents: number | null;
  is_active: boolean;
}): ProductVariantRow {
  return {
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    sizeLabel: row.size_label,
    colorName: row.color_name,
    garmentStyle: row.garment_style,
    material: row.material,
    printLocation: row.print_location,
    baseGarmentCostCents: row.base_garment_cost_cents,
    printCostCents: row.print_cost_cents,
    packagingCostCents: row.packaging_cost_cents,
    additionalCostCents: row.additional_cost_cents,
    retailPriceCents: row.retail_price_cents,
    wholesalePriceCents: row.wholesale_price_cents,
    compareAtPriceCents: row.compare_at_price_cents,
    isActive: row.is_active,
  };
}

export async function listProductVariants(tenantId: string, productId: string): Promise<ProductVariantRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("product_variants")
    .select(VARIANT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .order("sku");
  return (data ?? []).map(mapVariant);
}

/** Bulk-creates variants for combinations not already present (by sku).
 * Caller is responsible for having already checked
 * lib/catalog/variant-matrix.ts's duplicate-combination rules before
 * calling this — the database's own combo index is the last-resort
 * backstop, not the primary check. */
export async function createProductVariants(
  tenantId: string,
  productId: string,
  combinations: (VariantCombination & { sku: string })[],
): Promise<void> {
  if (combinations.length === 0) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("product_variants").insert(
    combinations.map((c) => ({
      tenant_id: tenantId,
      product_id: productId,
      sku: c.sku,
      size_label: c.sizeLabel,
      color_name: c.colorName,
      garment_style: c.garmentStyle,
      material: c.material,
      print_location: c.printLocation,
    })),
  );
  if (error) throw new Error(`Failed to create product variants: ${error.message}`);
}

export async function getVariantCostComponents(
  tenantId: string,
  variantId: string,
): Promise<Partial<Record<CostComponentKey, number>>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("product_cost_components")
    .select("component_key, amount_cents")
    .eq("tenant_id", tenantId)
    .eq("product_variant_id", variantId);
  const result: Partial<Record<CostComponentKey, number>> = {};
  for (const row of data ?? []) {
    result[row.component_key] = row.amount_cents;
  }
  return result;
}

export async function saveVariantCostComponents(
  tenantId: string,
  variantId: string,
  components: Partial<Record<CostComponentKey, number>>,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const rows = (Object.entries(components) as [CostComponentKey, number | undefined][]).map(
    ([componentKey, amountCents]) => ({
      tenant_id: tenantId,
      product_variant_id: variantId,
      component_key: componentKey,
      amount_cents: amountCents ?? 0,
    }),
  );
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("product_cost_components")
    .upsert(rows, { onConflict: "product_variant_id,component_key" });
  if (error) throw new Error(`Failed to save cost components: ${error.message}`);
}

export type VariantPricingInput = {
  retailPriceCents?: number | null;
  wholesalePriceCents?: number | null;
  compareAtPriceCents?: number | null;
};

/** Updates a variant's prices and always appends a price_history row —
 * price changes are never overwritten silently, per section 13. */
export async function updateVariantPricing(
  tenantId: string,
  variantId: string,
  input: VariantPricingInput,
  changedBy: string,
  reason?: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const patch: ProductVariantUpdate = {};
  if (input.retailPriceCents !== undefined) patch.retail_price_cents = input.retailPriceCents;
  if (input.wholesalePriceCents !== undefined) patch.wholesale_price_cents = input.wholesalePriceCents;
  if (input.compareAtPriceCents !== undefined) patch.compare_at_price_cents = input.compareAtPriceCents;

  const { error } = await supabase
    .from("product_variants")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", variantId);
  if (error) throw new Error(`Failed to update variant pricing: ${error.message}`);

  await supabase.from("product_price_history").insert({
    tenant_id: tenantId,
    product_variant_id: variantId,
    retail_price_cents: input.retailPriceCents ?? null,
    wholesale_price_cents: input.wholesalePriceCents ?? null,
    compare_at_price_cents: input.compareAtPriceCents ?? null,
    changed_by: changedBy,
    reason: reason ?? null,
  });
}

// ---------------------------------------------------------------------------
// product_design_links
// ---------------------------------------------------------------------------
export async function linkProductToDesign(
  tenantId: string,
  productId: string,
  designProjectId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("product_design_links")
    .upsert(
      { tenant_id: tenantId, product_id: productId, design_project_id: designProjectId },
      { onConflict: "product_id,design_project_id" },
    );
  if (error) throw new Error(`Failed to link product to design: ${error.message}`);
}

// ---------------------------------------------------------------------------
// dashboard metrics
// ---------------------------------------------------------------------------
export type CatalogDashboardMetrics = {
  productDrafts: number;
  activeProducts: number;
  productsMissingPricing: number;
  productsMissingVariants: number;
};

export async function getCatalogDashboardMetrics(tenantId: string): Promise<CatalogDashboardMetrics> {
  const supabase = await createSupabaseServerClient();
  const [{ count: productDrafts }, { count: activeProducts }, { data: products }] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "draft"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active"),
    supabase.from("products").select("id").eq("tenant_id", tenantId),
  ]);

  let productsMissingPricing = 0;
  let productsMissingVariants = 0;
  for (const product of products ?? []) {
    const variants = await listProductVariants(tenantId, product.id);
    if (variants.length === 0) {
      productsMissingVariants += 1;
      continue;
    }
    if (variants.some((v) => v.retailPriceCents === null)) {
      productsMissingPricing += 1;
    }
  }

  return {
    productDrafts: productDrafts ?? 0,
    activeProducts: activeProducts ?? 0,
    productsMissingPricing,
    productsMissingVariants,
  };
}
