import type { Metadata } from "next";
import Link from "next/link";
import { verifyToken } from "@/lib/security/tokens";
import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { issueToken } from "@/lib/security/tokens";
import { book } from "@/config/site";
import { EmailGateForm } from "@/components/marketing/email-gate-form";
import { ReferralShareWidget } from "@/components/marketing/referral-share-widget";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Waitlist Status",
  robots: { index: false, follow: false },
};

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const payload = params.token ? verifyToken(params.token, "status") : null;
  const subscriber = payload ? await getSubscriberStore().findById(payload.sub) : null;

  if (!subscriber) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center sm:px-8">
        <h1 className="font-serif-display text-3xl text-paper">Check your waitlist status</h1>
        <p className="mt-4 text-base leading-relaxed text-paper-dim">
          Enter the email you joined with and we&apos;ll send you a secure link to view your
          status, referral count, and {book.earlyAccessChapter} access.
        </p>
        <div className="mt-8">
          <EmailGateForm
            endpoint="/api/status"
            buttonLabel="Email Me My Status"
            trackEvent="status_lookup_requested"
          />
        </div>
      </div>
    );
  }

  const referralCount = await getSubscriberStore().countReferrals(subscriber.referralCode);
  const chapter12Token = issueToken(subscriber.id, "chapter12");

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-gold-300">
        Waitlist status
      </span>
      <h1 className="mt-4 font-serif-display text-3xl text-paper sm:text-4xl">
        Welcome back, {subscriber.firstName}
      </h1>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="glass-panel rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-paper-dim/60">Status</p>
          <p className="mt-2 font-serif-display text-lg text-paper">Confirmed</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-paper-dim/60">Referrals</p>
          <p className="mt-2 font-serif-display text-lg text-paper">{referralCount}</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-paper-dim/60">
            {book.earlyAccessChapter}
          </p>
          <p className="mt-2 font-serif-display text-lg text-paper">
            {subscriber.chapter12AccessedAt ? "Read" : "Not yet read"}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <Link href={`/chapter-12?token=${chapter12Token}`} className={buttonVariants("gold", "md")}>
          Open {book.earlyAccessChapter}
        </Link>
      </div>

      <div className="mt-12">
        <h2 className="font-serif-display text-lg text-paper">Your referral link</h2>
        <div className="mt-4">
          <ReferralShareWidget referralCode={subscriber.referralCode} />
        </div>
      </div>
    </div>
  );
}
