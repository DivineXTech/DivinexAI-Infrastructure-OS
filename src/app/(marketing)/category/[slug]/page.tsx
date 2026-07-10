import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/container";
import { ProductGrid } from "@/components/marketplace/product-grid";
import { SupabaseNotConfiguredNotice } from "@/components/supabase-status-notice";
import { isSupabaseConfigured } from "@/lib/env";
import { listCategories, listPublishedProducts } from "@/modules/catalog/service";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.replace(/-/g, " ") };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfiguredNotice what="This category" />;
  }

  const categories = await listCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const { products, total } = await listPublishedProducts({ categorySlug: slug, page, pageSize: PAGE_SIZE });

  return (
    <Section>
      <Container>
        <h1 className="font-display text-2xl font-medium text-ink sm:text-3xl">{category.name}</h1>
        {category.description ? <p className="mt-1 text-sm text-ink-muted">{category.description}</p> : null}
        <div className="mt-8">
          <ProductGrid
            products={products}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            buildHref={(p) => `/category/${slug}?page=${p}`}
          />
        </div>
      </Container>
    </Section>
  );
}
