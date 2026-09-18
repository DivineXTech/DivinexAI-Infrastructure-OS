import type { Metadata } from "next";
import Link from "next/link";

import { FinalCta } from "@/components/marketing/final-cta";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PageHeader } from "@/components/marketing/page-header";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "See how KushPrintCo OS takes you from a brand idea to an operating apparel business — brand, product, production, storefront, and growth.",
  alternates: { canonical: "/how-it-works" },
};

const PLATFORM_LAYERS = [
  { name: "Brand & Onboarding", description: "Resumable setup for your brand identity and first products." },
  { name: "Design Studio", description: "Garment design and mockup preview (full editor in a later phase)." },
  { name: "Startup Kit & Equipment", description: "Guided configuration matched to your budget and goals." },
  { name: "Production Operations", description: "Order-to-shipment workflow tools for in-house production." },
  { name: "Storefront", description: "A branded storefront for taking orders (later phase)." },
  { name: "Academy", description: "Training on the business side of running an apparel brand." },
  { name: "White-Label", description: "A licensed version of the platform for qualified operators." },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="One operating system, six steps to launch"
        description="KushPrintCo OS connects brand development, apparel design, equipment selection, training, production workflows, storefront tools, and business operations."
      />
      <HowItWorks />
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="What's inside"
          title="Every layer of the operating system"
          description="Some layers are live today; others are on the roadmap — see each page for current availability."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PLATFORM_LAYERS.map((layer) => (
            <div key={layer.name} className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-ink">{layer.name}</h3>
              <p className="mt-1 text-sm text-ink-muted">{layer.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Button asChild variant="outline">
            <Link href="/pricing">See Pricing</Link>
          </Button>
        </div>
      </section>
      <FinalCta />
    </>
  );
}
