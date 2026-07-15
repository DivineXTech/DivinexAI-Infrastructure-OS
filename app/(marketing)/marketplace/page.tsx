import type { Metadata } from "next";
import Link from "next/link";

import { AvailabilityBadge } from "@/components/marketing/availability-badge";
import { PageHeader } from "@/components/marketing/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "The KushPrintCo OS marketplace connects equipment, suppliers, and startup kits with attribution and commission structure for white-label partners.",
  alternates: { canonical: "/marketplace" },
};

const MARKETPLACE_PILLARS = [
  {
    title: "Equipment",
    description: "Heat presses, printers, cutters, and production equipment with selection guidance.",
    availability: "early-access" as const,
  },
  {
    title: "Suppliers",
    description: "Blank apparel and consumable suppliers, with support for your own supplier relationships too.",
    availability: "planned" as const,
  },
  {
    title: "Startup Kits",
    description: "Pre-configured equipment and training bundles matched to your production method.",
    availability: "early-access" as const,
  },
];

export default function MarketplacePage() {
  return (
    <>
      <PageHeader
        eyebrow="Marketplace"
        title="Equipment, suppliers, and kits in one place"
        description="We do not claim inventory availability we haven't confirmed, and affiliate/reseller attribution is disclosed wherever it applies."
      />
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {MARKETPLACE_PILLARS.map((pillar) => (
            <Card key={pillar.title}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{pillar.title}</CardTitle>
                  <AvailabilityBadge availability={pillar.availability} />
                </div>
                <CardDescription>{pillar.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
        <div className="mt-10 flex justify-center gap-3">
          <Button asChild>
            <Link href="/equipment">Browse Equipment</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/startup-kits">Browse Startup Kits</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
