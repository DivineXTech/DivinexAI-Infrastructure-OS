import { env } from "@/lib/env";
import { book } from "@/config/site";
import { BuyNowButton } from "@/components/marketing/buy-now-button";

/**
 * Hidden by default. "Keep checkout disabled on the public BookOS page
 * until founder approval" — set NEXT_PUBLIC_CHECKOUT_ENABLED=true (and the
 * Stripe env vars) to show this section. See SETUP.md.
 */
export function PurchaseSection() {
  if (!env.checkoutEnabled) return null;

  return (
    <section className="border-t border-hairline">
      <div className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-8 sm:py-24">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-gold-300">
          Now available
        </span>
        <h2 className="mt-4 font-serif-display text-3xl text-paper sm:text-4xl">
          Get {book.title} today
        </h2>
        <p className="mt-4 text-base leading-relaxed text-paper-dim">
          The complete {book.edition.toLowerCase()}, delivered instantly after purchase.
        </p>
        <div className="mt-8">
          <BuyNowButton />
        </div>
      </div>
    </section>
  );
}
