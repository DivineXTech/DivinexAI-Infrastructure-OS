import type { Metadata } from "next";
import Link from "next/link";

import { AvailabilityBadge } from "@/components/marketing/availability-badge";
import { ApparelDemo } from "@/components/marketing/apparel-demo";
import { PageHeader } from "@/components/marketing/page-header";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Design Studio",
  description:
    "A preview of the planned KushPrintCo OS design studio — garment selection, color, and print-placement preview.",
  alternates: { canonical: "/design-studio" },
};

const PLANNED_CAPABILITIES = [
  "Select garment type and color",
  "Upload artwork",
  "Add and position text",
  "Move, resize, and rotate design elements",
  "Choose print location with boundary validation",
  "Preview front and back",
  "Save drafts and duplicate designs",
  "Convert an approved design into a product draft",
];

export default function DesignStudioPage() {
  return (
    <>
      <PageHeader eyebrow="Design Studio" title="Design your product, visually">
        <div className="mt-4 flex justify-center">
          <AvailabilityBadge availability="planned" />
        </div>
      </PageHeader>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          <ApparelDemo />
          <div>
            <SectionHeading
              className="mx-0 text-left"
              eyebrow="What's coming"
              title="The full editor is in development"
            />
            <ul className="mt-6 flex flex-col gap-2">
              {PLANNED_CAPABILITIES.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-ink-muted">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-ink-muted">
              The preview beside this text shows garment color switching,
              simulated rotation, and design-zone placement — the same
              interaction model the full editor will build on.
            </p>
            <div className="mt-6">
              <Button asChild>
                <Link href="/signup">Start Your Brand</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
