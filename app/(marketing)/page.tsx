import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 py-24 text-center">
      <span className="rounded-full border border-border-strong px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
        Powered by the DivinexAI ecosystem
      </span>
      <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        Launch Your Clothing Brand.
        <br />
        We Supply Everything.
      </h1>
      <p className="max-w-2xl text-lg text-ink-muted">
        KushPrintCo OS is the apparel business operating system — brand
        creation, design studio, production, storefront, and operations, in
        one platform.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" asChild>
          <Link href="/signup">Start Your Clothing Brand</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/contact">Book a Consultation</Link>
        </Button>
      </div>
      <p className="text-xs text-ink-subtle">
        The full marketing site (startup kits, equipment marketplace, design
        studio preview, pricing, and white-label details) ships in the next
        build phase — see the project roadmap in{" "}
        <code>docs/IMPLEMENTATION_PLAN.md</code>.
      </p>
    </section>
  );
}
