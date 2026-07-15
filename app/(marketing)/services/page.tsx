import type { Metadata } from "next";
import Link from "next/link";

import { AvailabilityBadge } from "@/components/marketing/availability-badge";
import { PageHeader } from "@/components/marketing/page-header";
import { Button } from "@/components/ui/button";
import { SERVICES } from "@/lib/content/services";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Brand identity, product planning, equipment selection, and launch-planning services for apparel founders.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Services"
        title="Guidance at every stage of your launch"
        description="Some services are available today; others are in early access or planned — labeled honestly below."
      />
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="flex flex-col gap-4">
          {SERVICES.map((service) => (
            <div
              key={service.slug}
              className="flex items-start justify-between gap-4 rounded-lg border border-border p-5"
            >
              <div>
                <h3 className="text-base font-semibold text-ink">{service.name}</h3>
                <p className="mt-1 text-sm text-ink-muted">{service.description}</p>
              </div>
              <AvailabilityBadge availability={service.availability} />
            </div>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Button asChild size="lg">
            <Link href="/book-consultation">Book a Consultation</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
