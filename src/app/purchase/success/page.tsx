import type { Metadata } from "next";
import Link from "next/link";
import { getPurchaseStore } from "@/lib/store/purchase-store";
import { issueToken } from "@/lib/security/tokens";
import { book } from "@/config/site";
import { buttonVariants } from "@/components/ui/button";
import { ViewTracker } from "@/components/marketing/view-tracker";

export const metadata: Metadata = {
  title: "Purchase Confirmed",
  robots: { index: false, follow: false },
};

export default async function PurchaseSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const purchase = params.session_id
    ? await getPurchaseStore().findBySessionId(params.session_id)
    : null;

  if (!purchase) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center sm:px-8">
        <h1 className="font-serif-display text-3xl text-paper">Finishing up…</h1>
        <p className="mt-4 text-base leading-relaxed text-paper-dim">
          We&apos;re confirming your payment with Stripe — this usually takes just a few seconds.
          If you don&apos;t receive a confirmation email shortly, contact support.
        </p>
      </div>
    );
  }

  const downloadToken = issueToken(purchase.id, "ebook");

  return (
    <div className="mx-auto max-w-lg px-5 py-24 text-center sm:px-8">
      <ViewTracker event="purchase_completed" properties={{ amountCents: purchase.amountCents }} />
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-gold-300">
        Purchase confirmed
      </span>
      <h1 className="mt-4 font-serif-display text-3xl text-paper sm:text-4xl">
        Thank you for buying {book.title}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-paper-dim">
        A confirmation email with your download link is on its way to {purchase.email}.
      </p>
      <div className="mt-8">
        <Link href={`/purchase/download?token=${downloadToken}`} className={buttonVariants("gold", "lg")}>
          Go to Your Download
        </Link>
      </div>
    </div>
  );
}
