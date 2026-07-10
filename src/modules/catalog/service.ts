import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface CatalogFilters {
  categorySlug?: string;
  query?: string;
  freeOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  basePriceMinor: number;
  currencyCode: string;
  pricingModel: string;
  categoryName: string | null;
  creatorId: string;
  storefrontSlug: string;
  storeName: string;
  coverImageUrl: string | null;
}

/**
 * Deterministic Phase 1 marketplace listing: filter + paginate over
 * published, publicly-visible products, newest first. AI-powered ranking
 * is a Phase 3/4 concern (see ROADMAP.md) — this is the interface later
 * recommendation logic will plug into. Joins are resolved with a handful
 * of simple, individually-typed queries rather than Supabase embedded
 * selects, since the hand-rolled Database type here doesn't model FK
 * relationship metadata for embed type inference.
 */
export async function listPublishedProducts(filters: CatalogFilters = {}): Promise<{ products: CatalogProduct[]; total: number }> {
  const supabase = createSupabaseAdminClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 24;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .order("published_at", { ascending: false })
    .range(from, to);

  if (filters.query) query = query.ilike("title", `%${filters.query}%`);
  if (filters.freeOnly) query = query.eq("pricing_model", "free");
  if (filters.categorySlug) {
    const { data: category } = await supabase.from("product_categories").select("id").eq("slug", filters.categorySlug).maybeSingle();
    if (category) query = query.eq("category_id", category.id);
  }

  const { data: products, count, error } = await query;
  if (error) throw new Error(`Failed to list products: ${error.message}`);
  if (!products || products.length === 0) return { products: [], total: count ?? 0 };

  const creatorIds = [...new Set(products.map((p) => p.creator_id))];
  const categoryIds = [...new Set(products.map((p) => p.category_id).filter((id): id is string => Boolean(id)))];
  const productIds = products.map((p) => p.id);

  const [{ data: storefronts }, { data: categories }, { data: media }] = await Promise.all([
    supabase.from("storefronts").select("creator_id, slug, store_name").in("creator_id", creatorIds),
    categoryIds.length
      ? supabase.from("product_categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from("product_media").select("product_id, external_url, media_type").in("product_id", productIds).eq("media_type", "cover"),
  ]);

  const storefrontByCreator = new Map((storefronts ?? []).map((s) => [s.creator_id, s]));
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const coverByProduct = new Map((media ?? []).map((m) => [m.product_id, m.external_url]));

  const result: CatalogProduct[] = products.map((p) => {
    const storefront = storefrontByCreator.get(p.creator_id);
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      shortDescription: p.short_description,
      basePriceMinor: p.base_price_minor,
      currencyCode: p.currency_code,
      pricingModel: p.pricing_model,
      categoryName: p.category_id ? (categoryById.get(p.category_id)?.name ?? null) : null,
      creatorId: p.creator_id,
      storefrontSlug: storefront?.slug ?? "",
      storeName: storefront?.store_name ?? "",
      coverImageUrl: coverByProduct.get(p.id) ?? null,
    };
  });

  return { products: result, total: count ?? result.length };
}

export async function getPublishedProductBySlug(slug: string) {
  const supabase = createSupabaseAdminClient();
  const { data: product, error } = await supabase.from("products").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) throw new Error(`Failed to load product: ${error.message}`);
  if (!product) return null;

  const [{ data: category }, { data: storefront }, { data: media }] = await Promise.all([
    product.category_id
      ? supabase.from("product_categories").select("name, slug").eq("id", product.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("storefronts").select("slug, store_name, logo_url").eq("creator_id", product.creator_id).maybeSingle(),
    supabase.from("product_media").select("*").eq("product_id", product.id).order("sort_order"),
  ]);

  return { product, category, storefront, media: media ?? [] };
}

export async function listCategories() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("product_categories").select("*").eq("is_active", true).order("sort_order");
  if (error) throw new Error(`Failed to list categories: ${error.message}`);
  return data ?? [];
}

export interface CatalogCreator {
  username: string;
  storeName: string;
  bio: string | null;
  avatarUrl: string | null;
  country: string | null;
  category: string | null;
  isVerified: boolean;
}

export async function listFeaturedStorefronts(limit = 8): Promise<CatalogCreator[]> {
  const supabase = createSupabaseAdminClient();
  const { data: storefronts, error } = await supabase
    .from("storefronts")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to list storefronts: ${error.message}`);
  if (!storefronts || storefronts.length === 0) return [];

  const creatorIds = storefronts.map((s) => s.creator_id);
  const [{ data: creators }, { data: verifications }] = await Promise.all([
    supabase.from("creator_accounts").select("id, country_code").in("id", creatorIds),
    supabase.from("seller_verifications").select("creator_id, status").in("creator_id", creatorIds),
  ]);

  const creatorById = new Map((creators ?? []).map((c) => [c.id, c]));
  const verificationByCreator = new Map((verifications ?? []).map((v) => [v.creator_id, v.status]));

  return storefronts.map((s) => ({
    username: s.slug,
    storeName: s.store_name,
    bio: s.tagline,
    avatarUrl: s.logo_url,
    country: creatorById.get(s.creator_id)?.country_code ?? null,
    category: s.category,
    isVerified: verificationByCreator.get(s.creator_id) === "approved",
  }));
}

export async function getPublishedStorefrontByUsername(username: string) {
  const supabase = createSupabaseAdminClient();
  const { data: storefront, error } = await supabase
    .from("storefronts")
    .select("*")
    .eq("slug", username)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw new Error(`Failed to load storefront: ${error.message}`);
  if (!storefront) return null;

  const [{ data: links }, { data: products }, { data: verification }] = await Promise.all([
    supabase.from("storefront_links").select("*").eq("storefront_id", storefront.id).order("sort_order"),
    supabase
      .from("products")
      .select("*")
      .eq("creator_id", storefront.creator_id)
      .eq("status", "published")
      .order("published_at", { ascending: false }),
    supabase.from("seller_verifications").select("status").eq("creator_id", storefront.creator_id).maybeSingle(),
  ]);

  return { storefront, links: links ?? [], products: products ?? [], isVerified: verification?.status === "approved" };
}
