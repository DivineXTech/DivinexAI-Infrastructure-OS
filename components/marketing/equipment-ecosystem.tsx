import Link from "next/link";

import { SectionHeading } from "@/components/marketing/section-heading";
import { Button } from "@/components/ui/button";
import { EQUIPMENT_CATEGORIES } from "@/lib/content/equipment";

export function EquipmentEcosystem() {
  return (
    <section className="bg-surface-muted py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Equipment"
          title="Choose the right equipment for your production method"
          description="We help you select from the categories that power in-house apparel production."
        />
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {EQUIPMENT_CATEGORIES.map((category) => (
            <div
              key={category.slug}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <h3 className="text-sm font-semibold text-ink">{category.name}</h3>
              <p className="mt-1 text-xs text-ink-muted">{category.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Button asChild variant="outline">
            <Link href="/equipment">Find the Right Equipment</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
