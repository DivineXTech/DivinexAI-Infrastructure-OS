import type { Metadata } from "next";

import { LeadForm } from "@/components/marketing/lead-form";
import { PageHeader } from "@/components/marketing/page-header";
import { contact } from "@/lib/content/company";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the KushPrintCo OS team.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Get in touch"
        description="Have a question that doesn't fit a consultation? Send us a message and we'll follow up by email."
      />
      <section className="mx-auto max-w-lg px-6 py-16">
        <LeadForm leadType="general_contact" source="contact-page" submitLabel="Send Message" />
        {contact.email ? (
          <p className="mt-6 text-center text-sm text-ink-subtle">
            Or email us directly at{" "}
            <a href={`mailto:${contact.email}`} className="underline">
              {contact.email}
            </a>
          </p>
        ) : null}
      </section>
    </>
  );
}
