import type { Metadata } from "next";

import { LeadForm } from "@/components/marketing/lead-form";
import { PageHeader } from "@/components/marketing/page-header";

export const metadata: Metadata = {
  title: "Book a Consultation",
  description:
    "Book a consultation to discuss your brand, startup kit, equipment, or white-label plans with the KushPrintCo OS team.",
  alternates: { canonical: "/book-consultation" },
};

export default function BookConsultationPage() {
  return (
    <>
      <PageHeader
        eyebrow="Consultation"
        title="Book a Consultation"
        description="Tell us about your business and what you'd like to discuss — startup-kit configuration, equipment selection, production planning, or white-label licensing. We'll follow up to schedule a time."
      />
      <section className="mx-auto max-w-lg px-6 py-16">
        <LeadForm
          leadType="consultation_request"
          source="book-consultation-page"
          submitLabel="Request a Consultation"
          interestOptions={[
            "Startup-kit configuration",
            "Equipment selection",
            "Production planning",
            "White-label licensing",
            "General business launch planning",
          ]}
          interestLabel="What would you like to discuss?"
        />
      </section>
    </>
  );
}
