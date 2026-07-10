import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Container, Section } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/marketplace/product-card";
import { EmptyState } from "@/components/ui/states";
import { SupabaseNotConfiguredNotice } from "@/components/supabase-status-notice";
import { isSupabaseConfigured } from "@/lib/env";
import { getPublishedStorefrontByUsername } from "@/modules/catalog/service";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function StorefrontPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfiguredNotice what="This storefront" />;
  }

  const result = await getPublishedStorefrontByUsername(username);
  if (!result) notFound();

  const { storefront, links, products, isVerified } = result;

  return (
    <>
      <div className="relative h-40 w-full bg-paper-muted sm:h-56">
        {storefront.cover_image_url ? (
          <Image src={storefront.cover_image_url} alt="" fill className="object-cover" />
        ) : null}
      </div>
      <Section className="pt-0">
        <Container>
          <div className="-mt-10 flex flex-col items-center text-center">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-paper bg-surface">
              {storefront.logo_url ? (
                <Image src={storefront.logo_url} alt="" fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center font-display text-xl text-ink-muted">
                  {storefront.store_name.charAt(0)}
                </div>
              )}
            </div>
            <h1 className="mt-3 flex items-center gap-2 font-display text-2xl font-medium text-ink">
              {storefront.store_name}
              {isVerified ? <Badge tone="teal">Verified</Badge> : null}
            </h1>
            <p className="text-sm text-ink-muted">@{storefront.slug}</p>
            {storefront.description ? (
              <p className="mt-3 max-w-xl text-sm text-ink-muted">{storefront.description}</p>
            ) : null}
            {links.length > 0 ? (
              <div className="mt-3 flex flex-wrap justify-center gap-3">
                {links.map((link) => (
                  <a key={link.id} href={link.url} className="text-sm text-accent-strong hover:underline" target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-10">
            <h2 className="mb-4 font-display text-lg font-medium text-ink">Products</h2>
            {products.length === 0 ? (
              <EmptyState title="No products published yet" />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={{
                      slug: product.slug,
                      title: product.title,
                      coverImageUrl: null,
                      priceMinor: product.base_price_minor,
                      currency: product.currency_code,
                      isPayWhatYouWant: product.pricing_model === "pay_what_you_want",
                      isFree: product.pricing_model === "free",
                      creator: { username: storefront.slug, storeName: storefront.store_name },
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </Container>
      </Section>
    </>
  );
}
