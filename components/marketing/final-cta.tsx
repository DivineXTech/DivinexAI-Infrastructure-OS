import Link from "next/link";

import { Button } from "@/components/ui/button";
import { finalCta } from "@/lib/content/homepage";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-20 text-center">
      <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {finalCta.headline}
      </h2>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" asChild>
          <Link href={finalCta.primaryCta.href}>{finalCta.primaryCta.label}</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href={finalCta.secondaryCta.href}>{finalCta.secondaryCta.label}</Link>
        </Button>
      </div>
    </section>
  );
}
