import Link from "next/link";

import { AvailabilityBadge } from "@/components/marketing/availability-badge";
import { Button } from "@/components/ui/button";

export function WhiteLabelSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="rounded-xl border border-border bg-ink px-8 py-14 text-center text-background">
        <div className="mb-4 flex justify-center">
          <AvailabilityBadge availability="early-access" />
        </div>
        <h2 className="text-3xl font-semibold tracking-tight">
          Bring KushPrintCo OS to your own operation
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-background/80">
          Qualified apparel consultants, print shops, agencies, and regional
          operators can deploy a branded version of the platform under their
          own name. White-label licensing is in early access — reach out to
          discuss fit and timelines.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="accent" size="lg">
            <Link href="/white-label">Become a White-Label Partner</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
