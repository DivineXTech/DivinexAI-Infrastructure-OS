import type { Metadata } from "next";
import { verifyToken } from "@/lib/security/tokens";
import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { chapter12 } from "@/content/chapter-12";
import { book } from "@/config/site";
import { EmailGateForm } from "@/components/marketing/email-gate-form";

export const metadata: Metadata = {
  title: `${book.earlyAccessChapter}: ${chapter12.title}`,
  robots: { index: false, follow: false },
};

async function resolveAccess(token: string | undefined) {
  if (!token) return null;
  const payload = verifyToken(token, "chapter12");
  if (!payload) return null;

  const store = getSubscriberStore();
  const subscriber = await store.findById(payload.sub);
  if (!subscriber || subscriber.unsubscribed) return null;

  await store.markChapter12Accessed(subscriber.id);
  return subscriber;
}

export default async function Chapter12Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const subscriber = await resolveAccess(params.token);

  if (!subscriber) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center sm:px-8">
        <h1 className="font-serif-display text-3xl text-paper">This link has expired</h1>
        <p className="mt-4 text-base leading-relaxed text-paper-dim">
          Your Chapter 12 access link is invalid or has expired. Enter the email you joined the
          waitlist with and we&apos;ll send you a fresh one.
        </p>
        <div className="mt-8">
          <EmailGateForm
            endpoint="/api/status"
            buttonLabel="Resend Access Link"
            trackEvent="status_lookup_requested"
          />
        </div>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-gold-300">
        {book.earlyAccessChapter} &middot; Early Access &middot; {chapter12.readingTime}
      </span>
      <h1 className="mt-4 font-serif-display text-3xl text-paper sm:text-4xl">
        Chapter {chapter12.number}: {chapter12.title}
      </h1>
      <p className="mt-3 text-sm text-paper-dim/70">
        {book.title} — {book.author}
      </p>
      <div className="gold-divider my-8" />

      <div className="flex flex-col gap-10">
        {chapter12.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-serif-display text-xl text-paper">{section.heading}</h2>
            <div className="mt-3 flex flex-col gap-4">
              {section.paragraphs.map((paragraph, index) => (
                <p key={index} className="text-base leading-relaxed text-paper-dim">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-14 rounded-xl border border-gold-400/25 bg-gold-400/5 p-6 text-center">
        <p className="text-sm text-paper-dim">
          You&apos;re reading an early-access preview, {subscriber.firstName}. The full book
          releases soon — waitlist members hear first.
        </p>
      </div>
    </article>
  );
}
