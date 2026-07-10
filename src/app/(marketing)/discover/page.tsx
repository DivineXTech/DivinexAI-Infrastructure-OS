import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/container";
import { ProductGrid } from "@/components/marketplace/product-grid";
import { SupabaseNotConfiguredNotice } from "@/components/supabase-status-notice";
import { isSupabaseConfigured } from "@/lib/env";
import { listPublishedProducts } from "@/modules/catalog/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Discover" };

const PAGE_SIZE = 24;

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const configured = isSupabaseConfigured();
  const { products, total } = configured
    ? await listPublishedProducts({ page, pageSize: PAGE_SIZE })
    : { products: [], total: 0 };

  return (
    <Section>
      <Container>
        <h1 className="font-display text-2xl font-medium text-ink sm:text-3xl">Discover</h1>
        <p className="mt-1 text-sm text-ink-muted">Newest products published across FlowraMarket Africa.</p>
        <div className="mt-8">
          {configured ? (
            <ProductGrid
              products={products}
              total={total}
              page={page}
              pageSize={PAGE_SIZE}
              buildHref={(p) => `/discover?page=${p}`}
            />
          ) : (
            <SupabaseNotConfiguredNotice what="Discover" />
          )}
        </div>
      </Container>
    </Section>
  );
}
