import type { Metadata } from "next";
import { cookies } from "next/headers";
import { book } from "@/config/site";
import { WaitlistSection } from "@/components/marketing/waitlist-section";
import { isValidReferralCodeFormat, normalizeReferralCode } from "@/lib/referral";

export const metadata: Metadata = {
  title: "Join the Waitlist",
  description: `Complete the launch actions and join the early-access waitlist for ${book.title}.`,
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();

  const queryRef = params.ref ? normalizeReferralCode(params.ref) : undefined;
  const cookieRef = cookieStore.get("bb_ref")?.value;
  const referralCode =
    queryRef && isValidReferralCodeFormat(queryRef) ? queryRef : cookieRef;

  return (
    <div className="mx-auto max-w-4xl px-5 pt-16 text-center sm:px-8 sm:pt-24">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-gold-300">
        {book.edition} &middot; Early Access
      </span>
      <h1 className="mt-4 font-serif-display text-3xl text-paper sm:text-4xl">
        Join the {book.title} Waitlist
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-paper-dim">
        Complete the supporter actions below, then enter your details to unlock{" "}
        {book.earlyAccessChapter} early.
      </p>
      <WaitlistSection referralCode={referralCode} source="join" compact />
    </div>
  );
}
