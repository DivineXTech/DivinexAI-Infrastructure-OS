import type { Metadata } from "next";

import { AvailabilityBadge } from "@/components/marketing/availability-badge";
import { LeadForm } from "@/components/marketing/lead-form";
import { PageHeader } from "@/components/marketing/page-header";
import { SectionHeading } from "@/components/marketing/section-heading";

export const metadata: Metadata = {
  title: "White Label",
  description:
    "Deploy a branded version of KushPrintCo OS under your own name — for apparel consultants, print shops, agencies, and regional operators.",
  alternates: { canonical: "/white-label" },
};

const WHAT_YOU_GET = [
  "Your own platform name, logo, favicon, and colors",
  "Custom domain and email sender identity",
  "Feature entitlements matched to your plan",
  "Your own equipment catalog, startup kits, and training content",
  "Marketplace commission structure",
  "Powered-by attribution configuration",
];

export default function WhiteLabelPage() {
  return (
    <>
      <PageHeader
        eyebrow="White Label"
        title="Bring KushPrintCo OS to your own operation"
        description="Qualified apparel consultants, print shops, agencies, and regional operators can deploy a branded version of the platform under their own name."
      >
        <div className="mt-4 flex justify-center">
          <AvailabilityBadge availability="early-access" />
        </div>
      </PageHeader>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading className="mx-0 text-left" title="What's included" />
            <ul className="mt-6 flex flex-col gap-2">
              {WHAT_YOU_GET.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-ink-muted">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-ink-muted">
              White-label licensing is in early access. We&apos;re working
              with a limited number of partners while the tenant
              customization and admin console are built out — see the
              roadmap in our documentation for the current build phase.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-muted p-6">
            <h3 className="text-lg font-semibold text-ink">Discuss partnership fit</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Tell us about your business and we&apos;ll follow up to discuss fit and timelines.
            </p>
            <div className="mt-6">
              <LeadForm
                leadType="white_label_interest"
                source="white-label-page"
                submitLabel="Request Partnership Info"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
