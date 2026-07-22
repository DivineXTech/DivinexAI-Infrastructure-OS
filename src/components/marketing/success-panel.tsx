import Link from "next/link";
import { book } from "@/config/site";
import { buttonVariants } from "@/components/ui/button";
import { ReferralShareWidget } from "@/components/marketing/referral-share-widget";

export function SuccessPanel({
  firstName,
  referralCode,
  chapter12Href,
}: {
  firstName: string;
  referralCode: string;
  chapter12Href: string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-gold-300">
        You&apos;re confirmed
      </span>
      <h1 className="mt-4 font-serif-display text-3xl text-paper sm:text-4xl">
        Welcome to the waitlist, {firstName}.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-paper-dim">
        Thank you for supporting the launch of {book.title}. Check your inbox for a confirmation
        email with your {book.earlyAccessChapter} access link — or read it right now below.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link href={chapter12Href} className={buttonVariants("gold", "lg")}>
          Read {book.earlyAccessChapter} Now
        </Link>
      </div>

      <div className="mt-12 text-left">
        <h2 className="font-serif-display text-lg text-paper">Refer friends, earn rewards</h2>
        <p className="mt-2 text-sm text-paper-dim">
          Share your link — supporters who join through it count toward your referral rewards at
          launch.
        </p>
        <div className="mt-4">
          <ReferralShareWidget referralCode={referralCode} />
        </div>
      </div>

      <p className="mt-10 text-sm text-paper-dim/60">
        Want to check back later?{" "}
        <Link href="/status" className="text-gold-300 underline underline-offset-2">
          View your waitlist status
        </Link>
        .
      </p>
    </div>
  );
}
