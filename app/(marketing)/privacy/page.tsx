import type { Metadata } from "next";

import { PageHeader } from "@/components/marketing/page-header";
import { company, contact } from "@/lib/content/company";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${company.legalName} OS.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Privacy Policy" />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-ink">
          <strong>Draft — pending legal review.</strong> This is a working
          draft of our Privacy Policy, published for transparency while the
          platform is in early access. It has not been reviewed by counsel
          and should not be relied on as a final legal document.
        </div>

        <div className="flex flex-col gap-6 text-sm text-ink-muted">
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">1. Information we collect</h2>
            <p>
              Account information (name, email), brand and business
              information you provide during onboarding, content you upload
              (artwork, product images), and lead-form submissions
              (contact, consultation, and interest forms) including any UTM
              campaign parameters attached to your visit.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">2. How we use information</h2>
            <p>
              To operate the Service, respond to inquiries submitted
              through our forms, and improve the platform. We do not sell
              your personal information.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">3. Data storage and isolation</h2>
            <p>
              Your tenant&apos;s data is isolated from other tenants using
              database-level access controls (Row-Level Security). See our
              engineering documentation for technical detail if you&apos;re
              evaluating the platform for your own operation.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">4. Third parties</h2>
            <p>
              We use Supabase for authentication, database, and storage
              infrastructure. Payment processing (when live) will run
              through a third-party payment provider. We do not share your
              data with third parties for their own marketing purposes.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">5. Your choices</h2>
            <p>
              You can request access to, correction of, or deletion of your
              personal information by contacting us using the details
              below.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">6. Changes to this policy</h2>
            <p>
              We may update this policy as the Service develops. Material
              changes will be reflected on this page with an updated date.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">7. Contact</h2>
            <p>
              Questions about this policy can be sent to{" "}
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="underline">
                  {contact.email}
                </a>
              ) : (
                "our contact page"
              )}
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
