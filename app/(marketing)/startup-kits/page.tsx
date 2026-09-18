import type { Metadata } from "next";

import { AvailabilityBadge } from "@/components/marketing/availability-badge";
import { LeadForm } from "@/components/marketing/lead-form";
import { PageHeader } from "@/components/marketing/page-header";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STARTUP_KITS } from "@/lib/content/startup-kits";

export const metadata: Metadata = {
  title: "Startup Kits",
  description:
    "Guided equipment, blanks, consumables, and training configurations matched to your budget, print method, and experience level.",
  alternates: { canonical: "/startup-kits" },
};

export default function StartupKitsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Startup Kits"
        title="Build Your Startup Kit"
        description="A configuration of equipment, blank apparel, consumables, and training recommendations — matched to your budget, expected order volume, and print method."
      />
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STARTUP_KITS.map((kit) => (
            <Card key={kit.slug} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{kit.name}</CardTitle>
                  <AvailabilityBadge availability={kit.availability} />
                </div>
                <CardDescription>{kit.summary}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-col gap-3">
                <ul className="flex flex-col gap-1">
                  {kit.includes.map((item) => (
                    <li key={item} className="text-xs text-ink-muted">
                      &bull; {item}
                    </li>
                  ))}
                </ul>
                <p className="text-xs font-medium text-ink-subtle">Best for: {kit.bestFor}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section className="bg-surface-muted py-16">
        <div className="mx-auto max-w-lg px-6">
          <SectionHeading
            title="Get a recommendation for your setup"
            description="Tell us about your budget and goals and we'll follow up with a starting configuration."
          />
          <div className="mt-8">
            <LeadForm
              leadType="startup_kit_interest"
              source="startup-kits-page"
              submitLabel="Request My Kit Recommendation"
              interestOptions={STARTUP_KITS.map((k) => k.name)}
              interestLabel="Which kit interests you most?"
            />
          </div>
        </div>
      </section>
    </>
  );
}
