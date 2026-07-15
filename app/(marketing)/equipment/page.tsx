import type { Metadata } from "next";

import { LeadForm } from "@/components/marketing/lead-form";
import { PageHeader } from "@/components/marketing/page-header";
import { SectionHeading } from "@/components/marketing/section-heading";
import { EQUIPMENT_CATEGORIES } from "@/lib/content/equipment";

export const metadata: Metadata = {
  title: "Equipment",
  description:
    "Explore apparel production equipment categories — heat presses, DTF, sublimation, embroidery, screen printing, and more — with selection guidance.",
  alternates: { canonical: "/equipment" },
};

export default function EquipmentPage() {
  return (
    <>
      <PageHeader
        eyebrow="Equipment"
        title="Find the Right Equipment"
        description="We do not claim equipment is in stock unless real inventory data confirms it. Today, this page provides category guidance and selection support."
      />
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EQUIPMENT_CATEGORIES.map((category) => (
            <div key={category.slug} className="rounded-lg border border-border p-5">
              <h3 className="text-sm font-semibold text-ink">{category.name}</h3>
              <p className="mt-1 text-sm text-ink-muted">{category.description}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-surface-muted py-16">
        <div className="mx-auto max-w-lg px-6">
          <SectionHeading
            title="Tell us what you're producing"
            description="Get equipment guidance matched to your product type and production method."
          />
          <div className="mt-8">
            <LeadForm
              leadType="equipment_interest"
              source="equipment-page"
              submitLabel="Request Equipment Guidance"
              interestOptions={EQUIPMENT_CATEGORIES.map((c) => c.name)}
              interestLabel="Which category interests you most?"
            />
          </div>
        </div>
      </section>
    </>
  );
}
