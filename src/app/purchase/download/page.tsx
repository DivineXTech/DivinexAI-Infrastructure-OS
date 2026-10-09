import type { Metadata } from "next";
import { verifyToken } from "@/lib/security/tokens";
import { getPurchaseStore } from "@/lib/store/purchase-store";
import { getEbookDownloadUrl } from "@/lib/storage/ebook-storage";
import { book } from "@/config/site";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Download Your Ebook",
  robots: { index: false, follow: false },
};

export default async function PurchaseDownloadPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const payload = params.token ? verifyToken(params.token, "ebook") : null;
  const purchase = payload ? await getPurchaseStore().findById(payload.sub) : null;

  if (!purchase || purchase.status === "pending" || purchase.status === "refunded") {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center sm:px-8">
        <h1 className="font-serif-display text-3xl text-paper">Link unavailable</h1>
        <p className="mt-4 text-base leading-relaxed text-paper-dim">
          This download link is invalid, expired, or tied to a purchase we can&apos;t confirm.
          Check your purchase confirmation email, or contact support if you believe this is an
          error.
        </p>
      </div>
    );
  }

  const ebook = await getEbookDownloadUrl();

  return (
    <div className="mx-auto max-w-lg px-5 py-24 text-center sm:px-8">
      <h1 className="font-serif-display text-3xl text-paper">
        Your copy of {book.title}
      </h1>
      {ebook.available && ebook.url ? (
        <>
          <p className="mt-4 text-base leading-relaxed text-paper-dim">
            Thank you for your purchase. Your download is ready.
          </p>
          <div className="mt-8">
            <a href={ebook.url} className={buttonVariants("gold", "lg")} rel="noreferrer">
              Download the Ebook
            </a>
          </div>
          <p className="mt-2 text-xs text-paper-dim/50">
            This link expires in 10 minutes. Return to this page for a fresh one.
          </p>
        </>
      ) : (
        <p className="mt-4 text-base leading-relaxed text-paper-dim">
          Thank you for your purchase — it&apos;s confirmed. The final file is being prepared; we
          will email you the moment it&apos;s ready to download.
        </p>
      )}
    </div>
  );
}
