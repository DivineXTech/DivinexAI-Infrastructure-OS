import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/marketplace/product-grid";
import { SupabaseNotConfiguredNotice } from "@/components/supabase-status-notice";
import { isSupabaseConfigured } from "@/lib/env";
import { listPublishedProducts } from "@/modules/catalog/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

const PAGE_SIZE = 24;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const query = q?.trim() ?? "";

  return (
    <Section>
      <Container>
        <h1 className="font-display text-2xl font-medium text-ink sm:text-3xl">Search</h1>
        <form action="/search" className="mt-4 flex max-w-lg gap-2">
          <Input name="q" defaultValue={query} placeholder="Search products…" aria-label="Search products" />
          <Button type="submit">Search</Button>
        </form>

        <div className="mt-8">
          {!isSupabaseConfigured() ? (
            <SupabaseNotConfiguredNotice what="Search" />
          ) : query ? (
            <SearchResults query={query} page={page} />
          ) : (
            <p className="text-sm text-ink-muted">Enter a keyword to search products across FlowraMarket Africa.</p>
          )}
        </div>
      </Container>
    </Section>
  );
}

async function SearchResults({ query, page }: { query: string; page: number }) {
  const { products, total } = await listPublishedProducts({ query, page, pageSize: PAGE_SIZE });
  return (
    <ProductGrid
      products={products}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      buildHref={(p) => `/search?q=${encodeURIComponent(query)}&page=${p}`}
    />
  );
}
