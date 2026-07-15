import Link from "next/link";

import { AvailabilityBadge } from "@/components/marketing/availability-badge";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STARTUP_KITS } from "@/lib/content/startup-kits";

export function StartupKitPreview() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        eyebrow="Startup kits"
        title="A configuration matched to your budget and goals"
        description="Starting configurations across the most common print methods — request pricing for your specific setup."
      />
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {STARTUP_KITS.slice(0, 6).map((kit) => (
          <Card key={kit.slug} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{kit.name}</CardTitle>
                <AvailabilityBadge availability={kit.availability} />
              </div>
              <CardDescription>{kit.summary}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <p className="text-xs font-medium text-ink-subtle">Best for: {kit.bestFor}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-10 flex justify-center">
        <Button asChild variant="outline">
          <Link href="/startup-kits">Build Your Startup Kit</Link>
        </Button>
      </div>
    </section>
  );
}
