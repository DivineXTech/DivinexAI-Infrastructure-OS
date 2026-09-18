import type { Metadata } from "next";

import { AvailabilityBadge } from "@/components/marketing/availability-badge";
import { LeadForm } from "@/components/marketing/lead-form";
import { PageHeader } from "@/components/marketing/page-header";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ACADEMY_TOPICS } from "@/lib/content/academy";

export const metadata: Metadata = {
  title: "Academy",
  description:
    "Training on starting a clothing brand, print methods, pricing, equipment operation, marketing, fulfillment, and scaling production.",
  alternates: { canonical: "/academy" },
};

export default function AcademyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Academy"
        title="Learn the business, not just the printing"
        description="Training built for founders who are new to apparel — covering the brand, product, and operations decisions that matter most."
      >
        <div className="mt-4 flex justify-center">
          <AvailabilityBadge availability="early-access" />
        </div>
      </PageHeader>
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ACADEMY_TOPICS.map((topic) => (
            <div key={topic} className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-ink">{topic}</h3>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-ink-muted">
          Course content, quizzes, and completion certificates are still
          being developed.
        </p>
      </section>
      <section className="bg-surface-muted py-16">
        <div className="mx-auto max-w-lg px-6">
          <SectionHeading
            title="Join the early-access waitlist"
            description="We'll email you as soon as Academy courses are ready — no account required."
          />
          <div className="mt-8">
            <LeadForm
              leadType="early_access_signup"
              source="academy-page"
              submitLabel="Join the Waitlist"
              showMessage={false}
            />
          </div>
        </div>
      </section>
    </>
  );
}
