import type { Metadata } from "next";
import { verifyToken } from "@/lib/security/tokens";
import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { EmailGateForm } from "@/components/marketing/email-gate-form";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

async function resolveTokenUnsubscribe(token: string | undefined) {
  if (!token) return null;
  const payload = verifyToken(token, "unsubscribe");
  if (!payload) return null;

  const store = getSubscriberStore();
  const subscriber = await store.findById(payload.sub);
  if (!subscriber) return null;

  await store.markUnsubscribedByEmail(subscriber.email);
  return subscriber;
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const subscriber = await resolveTokenUnsubscribe(params.token);

  if (subscriber) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center sm:px-8">
        <h1 className="font-serif-display text-3xl text-paper">You&apos;ve been unsubscribed</h1>
        <p className="mt-4 text-base leading-relaxed text-paper-dim">
          {subscriber.email} will no longer receive launch emails. You&apos;re still on the
          waitlist and can still access Chapter 12 — you just won&apos;t hear from us by email.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-24 text-center sm:px-8">
      <h1 className="font-serif-display text-3xl text-paper">Unsubscribe</h1>
      <p className="mt-4 text-base leading-relaxed text-paper-dim">
        Enter your email and we&apos;ll remove you from launch emails immediately.
      </p>
      <div className="mt-8">
        <EmailGateForm
          endpoint="/api/unsubscribe"
          buttonLabel="Unsubscribe"
          trackEvent="unsubscribe_submitted"
        />
      </div>
    </div>
  );
}
