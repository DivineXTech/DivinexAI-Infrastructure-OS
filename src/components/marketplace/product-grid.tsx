import { ProductCard } from "@/components/marketplace/product-card";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/states";
import type { CatalogProduct } from "@/modules/catalog/service";

export function ProductGrid({
  products,
  total,
  page,
  pageSize,
  buildHref,
}: {
  products: CatalogProduct[];
  total: number;
  page: number;
  pageSize: number;
  buildHref: (page: number) => string;
}) {
  if (products.length === 0) {
    return <EmptyState title="No products match your filters" description="Try a different search term or category." />;
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={{
              slug: product.slug,
              title: product.title,
              coverImageUrl: product.coverImageUrl,
              priceMinor: product.basePriceMinor,
              currency: product.currencyCode,
              isPayWhatYouWant: product.pricingModel === "pay_what_you_want",
              isFree: product.pricingModel === "free",
              categoryName: product.categoryName,
              creator: { username: product.storefrontSlug, storeName: product.storeName },
            }}
          />
        ))}
      </div>
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} buildHref={buildHref} />
    </div>
  );
}
