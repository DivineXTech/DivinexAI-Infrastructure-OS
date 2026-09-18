import type { Metadata } from "next";

import { PageHeader } from "@/components/marketing/page-header";
import { company, contact } from "@/lib/content/company";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${company.legalName} OS.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Terms of Service" />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-ink">
          <strong>Draft — pending legal review.</strong> This is a working
          draft of our Terms of Service, published for transparency while
          the platform is in early access. It has not been reviewed by
          counsel and should not be relied on as a final legal document.
        </div>

        <div className="flex flex-col gap-6 text-sm text-ink-muted">
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">1. Acceptance of terms</h2>
            <p>
              By creating an account or otherwise using {company.legalName}{" "}
              OS (the &ldquo;Service&rdquo;), you agree to these Terms. If
              you do not agree, do not use the Service.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">2. Description of service</h2>
            <p>
              The Service provides tools and guidance for launching and
              operating an apparel business, including brand setup, design
              previews, equipment and startup-kit guidance, and (as later
              phases ship) production, storefront, and marketing tools.
              Features described on this site as &ldquo;planned&rdquo; or
              &ldquo;early access&rdquo; are not yet fully available.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">3. Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of
              your account credentials and for all activity under your
              account. Notify us promptly of any unauthorized use.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">4. Acceptable use</h2>
            <p>
              You agree not to misuse the Service, including attempting to
              access another tenant&apos;s data, circumvent access
              controls, or use the Service for unlawful purposes.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">5. Payments</h2>
            <p>
              Payment processing may run in a sandbox/mock mode during
              early access, meaning no real charge occurs. We will clearly
              indicate when live payment processing is enabled for your
              account.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">6. Intellectual property</h2>
            <p>
              You retain ownership of the brand assets, artwork, and content
              you upload. We retain ownership of the Service&apos;s software,
              design, and documentation.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">7. Disclaimers</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; without warranties
              of any kind. We do not guarantee business outcomes, income, or
              order volume from using the Service.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">8. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, {company.legalName} is
              not liable for indirect, incidental, or consequential damages
              arising from your use of the Service.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">9. Changes to these terms</h2>
            <p>
              We may update these Terms as the Service develops. Material
              changes will be reflected on this page with an updated date.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-ink">10. Contact</h2>
            <p>
              Questions about these Terms can be sent to{" "}
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
