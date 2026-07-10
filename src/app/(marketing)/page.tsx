import Link from "next/link";
import { Container, Section } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/marketplace/product-card";
import { CreatorCard } from "@/components/marketplace/creator-card";
import { EmptyState } from "@/components/ui/states";
import { SupabaseNotConfiguredNotice } from "@/components/supabase-status-notice";
import { isSupabaseConfigured } from "@/lib/env";
import { listPublishedProducts, listFeaturedStorefronts, listCategories } from "@/modules/catalog/service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return (
      <>
        <Hero />
        <SupabaseNotConfiguredNotice what="The marketplace feed" />
      </>
    );
  }

  const [{ products }, creators, categories] = await Promise.all([
    listPublishedProducts({ pageSize: 8 }),
    listFeaturedStorefronts(4),
    listCategories(),
  ]);

  return (
    <>
      <Hero />

      <Section>
        <Container>
          <SectionHeading title="Trending on FlowraMarket" href="/discover" />
          {products.length === 0 ? (
            <EmptyState title="No products yet" description="Be the first African creator to publish on FlowraMarket." />
          ) : (
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
          )}
        </Container>
      </Section>

      <Section className="bg-paper-muted">
        <Container>
          <SectionHeading title="Shop by category" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="rounded-lg border border-border bg-surface p-4 text-sm font-medium text-ink transition-shadow hover:shadow-md"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeading title="Featured creators" href="/creators" />
          {creators.length === 0 ? (
            <EmptyState title="No storefronts published yet" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {creators.map((creator) => (
                <CreatorCard key={creator.username} creator={creator} />
              ))}
            </div>
          )}
        </Container>
      </Section>

      <Section className="bg-ink text-paper">
        <Container className="flex flex-col items-center gap-4 text-center">
          <h2 className="font-display text-2xl font-medium sm:text-3xl">Turn what you know into income.</h2>
          <p className="max-w-xl text-sm text-paper/70">
            Build a storefront, publish your first product, and reach buyers across Africa and the diaspora — free to start.
          </p>
          <LinkButton href="/signup" size="lg">
            Start selling
          </LinkButton>
        </Container>
      </Section>
    </>
  );
}

function Hero() {
  return (
    <Section className="border-b border-border">
      <Container className="flex flex-col items-center gap-6 py-8 text-center">
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-strong">
          The AI-powered creator commerce marketplace for Africa
        </span>
        <h1 className="max-w-2xl font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          Create it. Sell it. Scale it.
        </h1>
        <p className="max-w-xl text-ink-muted">
          Storefronts, digital products, courses, and local payments — built for African creators, developers,
          educators, and businesses selling to Africa and the world.
        </p>
        <form action="/search" className="flex w-full max-w-lg gap-2">
          <Input name="q" placeholder="Search AI agents, courses, templates…" aria-label="Search products" />
          <LinkButton href="/discover" variant="secondary">
            Browse
          </LinkButton>
        </form>
      </Container>
    </Section>
  );
}

function SectionHeading({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h2 className="font-display text-xl font-medium text-ink sm:text-2xl">{title}</h2>
      {href ? (
        <Link href={href} className="text-sm font-medium text-accent-strong hover:underline">
          View all
        </Link>
      ) : null}
    </div>
  );
}
