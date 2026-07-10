import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatMinorUnits } from "@/lib/utils";

export interface ProductCardData {
  slug: string;
  title: string;
  coverImageUrl: string | null;
  priceMinor: number;
  currency: string;
  isPayWhatYouWant: boolean;
  isFree: boolean;
  categoryName?: string | null;
  creator: {
    username: string;
    storeName: string;
  };
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const priceLabel = product.isFree
    ? "Free"
    : product.isPayWhatYouWant
      ? `From ${formatMinorUnits(product.priceMinor, product.currency)}`
      : formatMinorUnits(product.priceMinor, product.currency);

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block overflow-hidden rounded-lg border border-border bg-surface transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-paper-muted">
        {product.coverImageUrl ? (
          <Image
            src={product.coverImageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-muted">
            <span className="font-display text-sm">FlowraMarket</span>
          </div>
        )}
        {product.categoryName ? (
          <Badge tone="neutral" className="absolute left-3 top-3 bg-surface/90">
            {product.categoryName}
          </Badge>
        ) : null}
      </div>
      <div className="p-4">
        <p className="line-clamp-2 font-medium text-ink">{product.title}</p>
        <p className="mt-1 text-sm text-ink-muted">{product.creator.storeName}</p>
        <p className="mt-2 text-sm font-semibold text-accent-strong">{priceLabel}</p>
      </div>
    </Link>
  );
}
