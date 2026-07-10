import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container, Section } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SupabaseNotConfiguredNotice } from "@/components/supabase-status-notice";
import { isSupabaseConfigured } from "@/lib/env";
import { getPublishedProductBySlug } from "@/modules/catalog/service";
import { formatMinorUnits } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isSupabaseConfigured()) return { title: slug };
  const result = await getPublishedProductBySlug(slug);
  return { title: result?.product.title ?? slug };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfiguredNotice what="This product page" />;
  }

  const result = await getPublishedProductBySlug(slug);
  if (!result) notFound();

  const { product, category, storefront, media } = result;
  const cover = media.find((m) => m.media_type === "cover");
  const gallery = media.filter((m) => m.media_type === "gallery");

  const priceLabel =
    product.pricing_model === "free"
      ? "Free"
      : product.pricing_model === "pay_what_you_want"
        ? `From ${formatMinorUnits(product.pwyw_minimum_minor, product.currency_code)}`
        : formatMinorUnits(product.base_price_minor, product.currency_code);

  return (
    <Section>
      <Container className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-paper-muted">
            {cover?.external_url ? (
              <Image src={cover.external_url} alt="" fill className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center font-display text-ink-muted">FlowraMarket</div>
            )}
          </div>
          {gallery.length > 0 ? (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {gallery.map((item) => (
                <div key={item.id} className="relative aspect-square overflow-hidden rounded-md bg-paper-muted">
                  {item.external_url ? <Image src={item.external_url} alt="" fill className="object-cover" /> : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-8 space-y-6">
            <div>
              <h2 className="font-display text-lg font-medium text-ink">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">{product.full_description}</p>
            </div>
            {Array.isArray(product.faqs) && product.faqs.length > 0 ? (
              <div>
                <h2 className="font-display text-lg font-medium text-ink">FAQ</h2>
                <dl className="mt-2 space-y-3">
                  {(product.faqs as { question: string; answer: string }[]).map((faq, i) => (
                    <div key={i}>
                      <dt className="text-sm font-medium text-ink">{faq.question}</dt>
                      <dd className="text-sm text-ink-muted">{faq.answer}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            {product.refund_policy ? (
              <div>
                <h2 className="font-display text-lg font-medium text-ink">Refund policy</h2>
                <p className="mt-2 text-sm text-ink-muted">{product.refund_policy}</p>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-border bg-surface p-6">
          {category ? <Badge tone="neutral">{category.name}</Badge> : null}
          <h1 className="mt-3 font-display text-2xl font-medium text-ink">{product.title}</h1>
          {product.short_description ? <p className="mt-2 text-sm text-ink-muted">{product.short_description}</p> : null}

          {storefront ? (
            <Link href={`/@${storefront.slug}`} className="mt-4 flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
              By <span className="font-medium text-ink">{storefront.store_name}</span>
            </Link>
          ) : null}

          <p className="mt-6 font-display text-3xl font-medium text-accent-strong">{priceLabel}</p>

          <LinkButton href={`/checkout/${product.slug}`} size="lg" className="mt-6 w-full">
            {product.pricing_model === "free" ? "Get it free" : "Buy now"}
          </LinkButton>

          {product.support_terms ? <p className="mt-4 text-xs text-ink-muted">{product.support_terms}</p> : null}
        </aside>
      </Container>
    </Section>
  );
}
